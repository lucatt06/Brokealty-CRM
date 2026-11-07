"use server";

import { AuthError, assertMember, assertOwns, assertWorkspace, requireAdminCtx, requireCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { getNextDocumentNumber } from "@/lib/sequences/document-number";
import { renderQuotePdf, type QuotePdfData } from "@/lib/pdf/quote-pdf";
import { uploadQuotePdf } from "@/lib/storage/upload-quote-pdf";
import type { Quote, SalesPaymentMethod } from "@prisma/client";

async function generateAndAttachPdf(quote: Quote, workspaceName: string, createdByName: string, lead: { firstName: string; lastName: string | null; phone: string }, property: { title: string }) {
  try {
    const pdfData: QuotePdfData = {
      quoteNumber: quote.quoteNumber,
      workspaceName,
      createdByName,
      leadName: `${lead.firstName} ${lead.lastName ?? ""}`.trim(),
      leadPhone: lead.phone,
      property,
      offeredPrice: quote.offeredPrice,
      currency: quote.currency,
      paymentMethod: quote.paymentMethod,
      downPayment: quote.downPayment,
      installments: quote.installments,
      conditionsText: quote.conditionsText,
      validUntil: quote.validUntil,
      createdAt: quote.createdAt,
    };
    const buffer = await renderQuotePdf(pdfData);
    const documentUrl = await uploadQuotePdf(buffer, quote.id);
    await prisma.quote.update({ where: { id: quote.id }, data: { documentUrl } });
  } catch (err) {
    console.error("Fallo generando/subiendo el PDF de la cotización:", err);
  }
}

type CreateQuoteInput = {
  leadId: string;
  propertyId: string;
  offeredPrice: number;
  currency: string;
  paymentMethod?: SalesPaymentMethod;
  downPayment?: number;
  installments?: number;
  conditionsText?: string;
  validUntil: string; // ISO
};

export async function createQuote(workspaceId: string, data: CreateQuoteInput) {
  const ctx0 = await requireCtx();
  assertWorkspace(ctx0, workspaceId);
  await assertOwns("lead", data.leadId, workspaceId);
  await assertOwns("property", data.propertyId, workspaceId);
  if (data.currency !== "DOP" && data.currency !== "USD") throw new AuthError("Moneda no válida.");
  if (!Number.isFinite(data.offeredPrice) || data.offeredPrice <= 0) throw new AuthError("Precio no válido.");
  const ctx = await getActiveWorkspace();
  if (!ctx) throw new Error("Sesión no válida.");

  const [lead, property] = await Promise.all([
    prisma.lead.findUnique({ where: { id: data.leadId }, select: { firstName: true, lastName: true, phone: true } }),
    prisma.property.findUnique({ where: { id: data.propertyId }, select: { title: true } }),
  ]);
  if (!lead) throw new Error("Lead no encontrado.");
  if (!property) throw new Error("Propiedad no encontrada.");

  const quoteNumber = await getNextDocumentNumber(workspaceId, "COT");

  const quote = await prisma.quote.create({
    data: {
      workspaceId, quoteNumber,
      leadId: data.leadId, propertyId: data.propertyId, createdById: ctx.user.id,
      offeredPrice: data.offeredPrice, currency: data.currency,
      paymentMethod: data.paymentMethod ?? null,
      downPayment: data.downPayment ?? null, installments: data.installments ?? null,
      conditionsText: data.conditionsText?.trim() || null,
      validUntil: new Date(data.validUntil),
      status: "BORRADOR",
    },
  });

  await generateAndAttachPdf(quote, ctx.workspace.name, ctx.user.name, lead, property);

  revalidatePath("/cotizaciones");
  return { quoteId: quote.id };
}

export async function sendQuote(quoteId: string) {
  const ctx = await requireCtx();
  await assertOwns("quote", quoteId, ctx.workspace.id);
  const quote = await prisma.quote.update({
    where: { id: quoteId },
    data: { status: "ENVIADA", sentAt: new Date() },
    select: { workspaceId: true, leadId: true, quoteNumber: true },
  });
  await prisma.activity.create({
    data: { workspaceId: quote.workspaceId, leadId: quote.leadId, type: "QUOTE_ENVIADA", description: `Cotización ${quote.quoteNumber} enviada` },
  });
  revalidatePath("/cotizaciones");
}

export async function acceptQuote(quoteId: string) {
  const ctx = await requireCtx();
  await assertOwns("quote", quoteId, ctx.workspace.id);
  const quote = await prisma.quote.update({
    where: { id: quoteId },
    data: { status: "ACEPTADA", respondedAt: new Date() },
    select: { workspaceId: true, leadId: true, quoteNumber: true },
  });
  await prisma.activity.create({
    data: { workspaceId: quote.workspaceId, leadId: quote.leadId, type: "QUOTE_ACEPTADA", description: `Cotización ${quote.quoteNumber} aceptada` },
  });
  revalidatePath("/cotizaciones");
}

export async function rejectQuote(quoteId: string) {
  const ctx = await requireCtx();
  await assertOwns("quote", quoteId, ctx.workspace.id);
  await prisma.quote.update({ where: { id: quoteId }, data: { status: "RECHAZADA", respondedAt: new Date() } });
  revalidatePath("/cotizaciones");
}

/**
 * Convierte una cotización aceptada en una Orden de Venta — copia los términos,
 * solo se puede hacer una vez (Documento 7, sección 4.3).
 */
export async function convertQuoteToSalesOrder(quoteId: string, dealId: string) {
  const ctx = await requireCtx();
  await assertOwns("quote", quoteId, ctx.workspace.id);
  await assertOwns("deal", dealId, ctx.workspace.id);

  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new Error("Cotización no encontrada.");
  if (quote.status === "CONVERTIDA") throw new Error("Esta cotización ya fue convertida a una orden de venta.");

  const orderNumber = await getNextDocumentNumber(quote.workspaceId, "OV");

  const [salesOrder] = await prisma.$transaction([
    prisma.salesOrder.create({
      data: {
        workspaceId: quote.workspaceId, orderNumber,
        leadId: quote.leadId, propertyId: quote.propertyId, quoteId: quote.id, dealId,
        soldById: ctx.user.id,
        salePrice: quote.offeredPrice, currency: quote.currency,
        paymentMethod: quote.paymentMethod ?? "CONTADO",
        downPayment: quote.downPayment, installments: quote.installments,
        conditionsText: quote.conditionsText,
        status: "BORRADOR",
      },
    }),
    prisma.quote.update({ where: { id: quoteId }, data: { status: "CONVERTIDA" } }),
  ]);

  revalidatePath("/cotizaciones");
  revalidatePath("/ordenes-venta");
  return { salesOrderId: salesOrder.id };
}
