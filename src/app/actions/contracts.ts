"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { renderContractPdf } from "@/lib/pdf/contract-pdf";
import { uploadContractPdf } from "@/lib/storage/upload-contract-pdf";

async function requireAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx || (ctx.role !== "ADMIN_DEALER" && !ctx.isSuperAdmin)) {
    throw new Error("Solo un Admin Dealer puede administrar plantillas de contrato.");
  }
  return ctx;
}

// ── Plantillas ───────────────────────────────────────────────────
export async function createContractTemplate(workspaceId: string, data: { name: string; documentType: string; bodyTemplate: string }) {
  await requireAdmin();
  await prisma.contractTemplate.create({
    data: { workspaceId, name: data.name.trim(), documentType: data.documentType.trim(), bodyTemplate: data.bodyTemplate },
  });
  revalidatePath("/configuracion");
}

export async function updateContractTemplate(id: string, data: { name: string; documentType: string; bodyTemplate: string }) {
  await requireAdmin();
  await prisma.contractTemplate.update({
    where: { id },
    data: { name: data.name.trim(), documentType: data.documentType.trim(), bodyTemplate: data.bodyTemplate },
  });
  revalidatePath("/configuracion");
}

export async function toggleContractTemplateActive(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.contractTemplate.update({ where: { id }, data: { isActive } });
  revalidatePath("/configuracion");
}

/** Placeholders simples {{cliente.nombre}} — reemplazo de texto, no motor de templating (así lo describe el Documento 5). */
function resolvePlaceholders(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+\.\w+)\}\}/g, (match, key) => values[key] ?? match);
}

export async function generateContract(salesOrderId: string, templateId: string) {
  const ctx = await getActiveWorkspace();
  if (!ctx) throw new Error("Sesión no válida.");

  const [order, template] = await Promise.all([
    prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        lead: { select: { firstName: true, lastName: true, phone: true } },
        vehicle: { select: { make: true, model: true, year: true, vin: true } },
        soldBy: { select: { name: true } },
      },
    }),
    prisma.contractTemplate.findUnique({ where: { id: templateId } }),
  ]);
  if (!order) throw new Error("Orden de venta no encontrada.");
  if (!template) throw new Error("Plantilla no encontrada.");

  const values: Record<string, string> = {
    "cliente.nombre": `${order.lead.firstName} ${order.lead.lastName ?? ""}`.trim(),
    "cliente.telefono": order.lead.phone,
    "vehiculo.info": `${order.vehicle.make} ${order.vehicle.model} ${order.vehicle.year}`,
    "vehiculo.vin": order.vehicle.vin ?? "—",
    "orden.numero": order.orderNumber,
    "orden.precio": new Intl.NumberFormat("es-DO", { style: "currency", currency: order.currency, minimumFractionDigits: 0 }).format(order.salePrice),
    "orden.moneda": order.currency,
    "orden.fecha": new Intl.DateTimeFormat("es-DO", { dateStyle: "medium" }).format(new Date()),
    "vendedor.nombre": order.soldBy.name,
  };
  const renderedBody = resolvePlaceholders(template.bodyTemplate, values);

  const contract = await prisma.contract.create({
    data: {
      workspaceId: order.workspaceId, salesOrderId, templateId, renderedBody,
      generatedById: ctx.user.id, status: "GENERADO",
    },
  });

  try {
    const buffer = await renderContractPdf({ workspaceName: ctx.workspace.name, documentType: template.documentType, renderedBody, generatedAt: new Date() });
    const documentUrl = await uploadContractPdf(buffer, contract.id);
    await prisma.contract.update({ where: { id: contract.id }, data: { documentUrl } });
  } catch (err) {
    console.error("Fallo generando/subiendo el PDF del contrato:", err);
  }

  await prisma.activity.create({
    data: { workspaceId: order.workspaceId, leadId: order.leadId, type: "CONTRACT_GENERADO", description: `Contrato generado (${template.name})`, metadata: { salesOrderId, contractId: contract.id } },
  });

  revalidatePath(`/ordenes-venta/${salesOrderId}`);
  return { contractId: contract.id };
}

export async function markContractSent(contractId: string) {
  const contract = await prisma.contract.update({ where: { id: contractId }, data: { status: "ENVIADO", sentAt: new Date() }, select: { salesOrderId: true } });
  revalidatePath(`/ordenes-venta/${contract.salesOrderId}`);
}

/** FIRMADO es inmutable (Documento 7, sección 7.2) — solo se anula y se genera uno nuevo. */
export async function markContractSigned(contractId: string) {
  const contract = await prisma.contract.findUnique({ where: { id: contractId }, select: { status: true, workspaceId: true, salesOrderId: true } });
  if (!contract) throw new Error("Contrato no encontrado.");
  if (contract.status === "FIRMADO") throw new Error("Este contrato ya está firmado.");
  if (contract.status === "ANULADO") throw new Error("Este contrato está anulado.");

  await prisma.contract.update({ where: { id: contractId }, data: { status: "FIRMADO", signedAt: new Date() } });
  await prisma.activity.create({
    data: { workspaceId: contract.workspaceId, type: "CONTRACT_FIRMADO", description: "Contrato firmado", metadata: { salesOrderId: contract.salesOrderId, contractId } },
  });
  revalidatePath(`/ordenes-venta/${contract.salesOrderId}`);
}

export async function voidContract(contractId: string) {
  await requireAdmin();
  const contract = await prisma.contract.update({ where: { id: contractId }, data: { status: "ANULADO" }, select: { salesOrderId: true } });
  revalidatePath(`/ordenes-venta/${contract.salesOrderId}`);
}
