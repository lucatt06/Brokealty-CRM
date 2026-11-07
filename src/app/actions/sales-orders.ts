"use server";

import { AuthError, assertOwns, assertWorkspace, requireAdminCtx, requireCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { fireAutomationTrigger } from "@/lib/jobs/run-automations";
import { evaluateAuthorizationTriggers } from "@/lib/sales/authorization-triggers";
import { getNextDocumentNumber } from "@/lib/sequences/document-number";
import { logAuditEvent } from "@/lib/audit";
import type { CommissionRule, ProcedureType, SalesPaymentMethod } from "@prisma/client";

/** Movido tal cual desde deals.ts — closeDeal ya no cierra ventas, completeSalesOrder sí. */
function computeCommissionAmount(
  rule: CommissionRule,
  order: { value: number; currency: string },
  property: { commissionPct: number | null } | null
): number {
  if (rule.calcType === "FIXED_AMOUNT") return rule.fixedAmount ?? 0;
  // Si la propiedad trae un % pactado con el propietario, manda sobre el % genérico de la regla.
  const percent = property?.commissionPct ?? rule.percent ?? 0;
  return order.value * (percent / 100);
}

async function requireAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx || (ctx.role !== "ADMIN" && !ctx.isSuperAdmin)) {
    throw new Error("Solo un Administrador puede hacer esto.");
  }
  return ctx;
}

/**
 * Reemplaza el cierre instantáneo de closeDeal("WON") — crea (o reutiliza) la
 * Orden de Venta en BORRADOR para el deal. El deal se queda OPEN hasta que la
 * orden se complete de verdad (Documento 7, sección 6.1).
 */
export async function createSalesOrderFromDeal(dealId: string): Promise<{ salesOrderId: string }> {
  const ctx = await requireCtx();
  await assertOwns("deal", dealId, ctx.workspace.id);

  const existing = await prisma.salesOrder.findUnique({ where: { dealId }, select: { id: true } });
  if (existing) return { salesOrderId: existing.id };

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { workspaceId: true, leadId: true, propertyId: true, assignedToId: true, value: true, currency: true },
  });
  if (!deal) throw new Error("Negocio no encontrado.");
  if (!deal.propertyId) throw new Error("Este negocio no tiene una propiedad vinculado — no se puede iniciar una venta formal.");
  if (!deal.value) throw new Error("Este negocio no tiene un valor definido — asígnale un precio antes de marcarlo ganado.");

  const orderNumber = await getNextDocumentNumber(deal.workspaceId, "OV");

  const salesOrder = await prisma.salesOrder.create({
    data: {
      workspaceId: deal.workspaceId,
      orderNumber,
      leadId: deal.leadId,
      propertyId: deal.propertyId,
      dealId,
      soldById: deal.assignedToId ?? ctx.user.id,
      salePrice: deal.value,
      currency: deal.currency,
      paymentMethod: "CONTADO",
      status: "BORRADOR",
    },
  });

  await prisma.activity.create({
    data: {
      workspaceId: deal.workspaceId, leadId: deal.leadId, propertyId: deal.propertyId,
      type: "SALES_ORDER_CREATED", description: `Orden de venta ${orderNumber} creada`,
      metadata: { salesOrderId: salesOrder.id },
    },
  });

  revalidatePath("/negocios");
  revalidatePath("/ordenes-venta");
  return { salesOrderId: salesOrder.id };
}

type UpdateTermsInput = {
  salePrice: number;
  currency: string;
  paymentMethod: SalesPaymentMethod;
  downPayment?: number | null;
  installments?: number | null;
  conditionsText?: string | null;
  ddcId?: string | null;
};

export async function updateSalesOrderTerms(salesOrderId: string, data: UpdateTermsInput) {
  const ctx0 = await requireCtx();
  await assertOwns("salesOrder", salesOrderId, ctx0.workspace.id);
  await assertOwns("ddc", data.ddcId, ctx0.workspace.id);
  if (data.currency !== "DOP" && data.currency !== "USD") throw new AuthError("Moneda no válida.");
  if (!Number.isFinite(data.salePrice) || data.salePrice <= 0) throw new AuthError("Precio no válido.");
  await prisma.salesOrder.update({
    where: { id: salesOrderId },
    data: {
      salePrice: data.salePrice, currency: data.currency, paymentMethod: data.paymentMethod,
      downPayment: data.downPayment ?? null, installments: data.installments ?? null,
      conditionsText: data.conditionsText?.trim() || null, ddcId: data.ddcId ?? null,
    },
  });
  revalidatePath(`/ordenes-venta/${salesOrderId}`);
}

/**
 * La cascada real de venta (Documento 7, sección 6.2) — adaptada: se omiten los
 * pasos que dependen de Contabilidad (2C, no construida) y de PortalListing
 * (nunca construido). Ver plan de Fase 2B para el detalle de qué se omite y por qué.
 */
export async function completeSalesOrder(salesOrderId: string) {
  const ctx0 = await requireCtx();
  await assertOwns("salesOrder", salesOrderId, ctx0.workspace.id);
  const ctx = await getActiveWorkspace();
  if (!ctx) throw new Error("Sesión no válida.");

  const order = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    include: {
      property: { select: { id: true, title: true, status: true, listingType: true, minimumPrice: true, priceDOP: true, priceUSD: true, commissionPct: true } },
      ddc: { select: { status: true, expiresAt: true } },
      deal: { select: { id: true, assignedToId: true } },
    },
  });
  if (!order) throw new Error("Orden de venta no encontrada.");
  if (order.status === "COMPLETADA") throw new Error("Esta orden ya está completada.");
  if (order.status === "CANCELADA") throw new Error("Esta orden fue cancelada.");

  // 1. DDC aprobado y vigente
  const ddcOk = order.ddc?.status === "APROBADO" && (!order.ddc.expiresAt || order.ddc.expiresAt > new Date());
  if (!ddcOk) throw new Error("Esta venta requiere una Debida Diligencia del Cliente aprobada y vigente antes de completarse.");

  // 2. Propiedad sigue disponible (no vendido por otra orden en paralelo)
  if (order.property.status !== "DISPONIBLE") throw new Error("La propiedad ya no está disponible.");

  // 3. Autorización — se evalúa fresca contra las reglas activas del workspace
  const triggers = await evaluateAuthorizationTriggers(order.workspaceId, order, order.property);
  if (triggers.length) {
    const approved = await prisma.salesAuthorization.findFirst({ where: { salesOrderId, status: "APROBADA" } });
    if (!approved) {
      const alreadyRequested = await prisma.salesAuthorization.findFirst({ where: { salesOrderId, status: "PENDIENTE" } });
      if (!alreadyRequested) {
        await prisma.$transaction([
          prisma.salesOrder.update({ where: { id: salesOrderId }, data: { status: "PENDIENTE_AUTORIZACION" } }),
          ...triggers.map((t) =>
            prisma.salesAuthorization.create({
              data: { workspaceId: order.workspaceId, salesOrderId, trigger: t.trigger, triggerDetail: t.detail, requestedById: ctx.user.id },
            })
          ),
        ]);
        await prisma.activity.create({
          data: { workspaceId: order.workspaceId, leadId: order.leadId, type: "AUTHORIZATION_REQUESTED", description: `Autorización requerida: ${triggers.map((t) => t.trigger).join(", ")}`, metadata: { salesOrderId } },
        });
      }
      throw new Error("Esta venta requiere autorización de un Administrador antes de completarse.");
    }
  }

  // Todo validado — ejecutar la cascada.
  const propertyPart = order.property.title;

  const [otherInterestedLeads, commissionRule, workspace] = await Promise.all([
    prisma.lead.findMany({
      where: { workspaceId: order.workspaceId, interestedPropertyId: order.propertyId, id: { not: order.leadId } },
      select: { id: true, assignedTo: true },
    }),
    order.deal.assignedToId
      ? prisma.commissionRule.findFirst({ where: { workspaceId: order.workspaceId, isActive: true }, orderBy: { createdAt: "desc" } })
      : Promise.resolve(null),
    prisma.workspace.findUnique({ where: { id: order.workspaceId }, select: { requiredPostSaleProcedures: true } }),
  ]);
  const commissionAmount = commissionRule
    ? computeCommissionAmount(commissionRule, { value: order.salePrice, currency: order.currency }, order.property)
    : null;

  await prisma.$transaction([
    prisma.salesOrder.update({ where: { id: salesOrderId }, data: { status: "COMPLETADA", completedAt: new Date(), saleDate: new Date() } }),
    prisma.deal.update({ where: { id: order.dealId }, data: { status: "WON", closedAt: new Date() } }),
    prisma.property.update({
      where: { id: order.propertyId },
      data: { status: order.property.listingType === "ALQUILER" ? "ALQUILADO" : "VENDIDO", soldDate: new Date(), soldToLeadId: order.leadId, soldByUserId: order.soldById },
    }),
    prisma.activity.create({
      data: {
        workspaceId: order.workspaceId, leadId: order.leadId, propertyId: order.propertyId,
        type: "SALES_ORDER_COMPLETED", description: `Venta completada — orden ${order.orderNumber} · ${propertyPart}`,
        metadata: { salesOrderId },
      },
    }),
    ...(commissionRule && commissionAmount != null && order.deal.assignedToId
      ? [prisma.commission.create({
          data: {
            workspaceId: order.workspaceId, dealId: order.dealId, userId: order.deal.assignedToId, ruleId: commissionRule.id,
            baseAmount: order.salePrice, amount: commissionAmount, currency: order.currency,
          },
        })]
      : []),
    ...(workspace?.requiredPostSaleProcedures ?? []).map((type: ProcedureType) =>
      prisma.postSaleProcedure.create({ data: { workspaceId: order.workspaceId, salesOrderId, propertyId: order.propertyId, type } })
    ),
    ...otherInterestedLeads.flatMap((lead) => [
      prisma.task.create({
        data: { workspaceId: order.workspaceId, leadId: lead.id, assignedTo: lead.assignedTo, title: `Ofrecer alternativa — ${propertyPart} ya se vendió`, priority: "ALTA" },
      }),
      prisma.activity.create({
        data: { workspaceId: order.workspaceId, leadId: lead.id, type: "LEAD_UPDATED", description: `La propiedad de interés (${propertyPart}) fue vendida a otro cliente — se creó tarea de seguimiento` },
      }),
    ]),
  ]);

  await logAuditEvent({
    actorUserId: ctx.user.id, actorName: ctx.user.name,
    workspaceId: order.workspaceId, workspaceName: ctx.workspace.name,
    action: "SALES_ORDER_COMPLETED", details: { salesOrderId, orderNumber: order.orderNumber, propertyId: order.propertyId },
  });

  await fireAutomationTrigger(order.workspaceId, "PROPERTY_SOLD", { leadId: order.leadId });

  revalidatePath("/negocios");
  revalidatePath("/ordenes-venta");
  revalidatePath(`/ordenes-venta/${salesOrderId}`);
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${order.propertyId}`);
  revalidatePath("/leads");
  revalidatePath("/comisiones");
}

export async function cancelSalesOrder(salesOrderId: string, reason: string) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("salesOrder", salesOrderId, ctx0.workspace.id);
  if (!reason.trim()) throw new Error("Cancelar una orden de venta requiere un motivo.");
  const ctx = await requireAdmin();
  const order = await prisma.salesOrder.update({
    where: { id: salesOrderId },
    data: { status: "CANCELADA", cancelledAt: new Date(), cancellationReason: reason.trim() },
    select: { workspaceId: true, leadId: true },
  });
  await logAuditEvent({
    actorUserId: ctx.user.id, actorName: ctx.user.name,
    workspaceId: order.workspaceId, workspaceName: ctx.workspace.name,
    action: "SALES_ORDER_CANCELLED", details: { salesOrderId, reason: reason.trim() },
  });
  revalidatePath(`/ordenes-venta/${salesOrderId}`);
  revalidatePath("/ordenes-venta");
}
