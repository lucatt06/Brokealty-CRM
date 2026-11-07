"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { logAuditEvent } from "@/lib/audit";
import type { AuthorizationTrigger } from "@prisma/client";

async function requireAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx || (ctx.role !== "ADMIN_DEALER" && !ctx.isSuperAdmin)) {
    throw new Error("Solo un Admin Dealer puede aprobar o rechazar autorizaciones de venta.");
  }
  return ctx;
}

type EvaluableSalesOrder = { salePrice: number; currency: string; paymentMethod: string };
type EvaluableVehicle = { minimumPrice: number | null; priceDOP: number | null; priceUSD: number | null };

/**
 * Evalúa las AuthorizationRule activas del workspace contra una orden — si no hay
 * ninguna regla activa, no se exige autorización para nadie (Documento 7, sección
 * 16.4: nunca hardcodear umbrales, todo configurable en BD).
 */
export async function evaluateAuthorizationTriggers(
  workspaceId: string,
  order: EvaluableSalesOrder,
  vehicle: EvaluableVehicle
): Promise<{ trigger: AuthorizationTrigger; detail: string }[]> {
  const rules = await prisma.authorizationRule.findMany({ where: { workspaceId, isActive: true } });
  const triggered: { trigger: AuthorizationTrigger; detail: string }[] = [];

  for (const rule of rules) {
    if (rule.trigger === "BELOW_MINIMUM_PRICE" && vehicle.minimumPrice != null && order.salePrice < vehicle.minimumPrice) {
      triggered.push({ trigger: rule.trigger, detail: `Precio ${order.salePrice} vs mínimo ${vehicle.minimumPrice}` });
    }
    if (rule.trigger === "DISCOUNT_THRESHOLD" && rule.discountPercentThreshold != null) {
      const publicPrice = order.currency === "USD" ? vehicle.priceUSD : vehicle.priceDOP;
      if (publicPrice && publicPrice > 0) {
        const discountPercent = ((publicPrice - order.salePrice) / publicPrice) * 100;
        if (discountPercent > rule.discountPercentThreshold) {
          triggered.push({ trigger: rule.trigger, detail: `Descuento ${discountPercent.toFixed(1)}% vs umbral ${rule.discountPercentThreshold}%` });
        }
      }
    }
    if (rule.trigger === "FINANCED_SALE" && (order.paymentMethod === "FINANCIAMIENTO_BANCARIO" || order.paymentMethod === "MIXTO")) {
      triggered.push({ trigger: rule.trigger, detail: `Forma de pago: ${order.paymentMethod}` });
    }
    if (rule.trigger === "HIGH_VALUE" && rule.amountThreshold != null && order.salePrice > rule.amountThreshold) {
      triggered.push({ trigger: rule.trigger, detail: `Monto ${order.salePrice} vs umbral ${rule.amountThreshold}` });
    }
  }

  return triggered;
}

export async function approveAuthorization(authorizationId: string, notes?: string) {
  const ctx = await requireAdmin();
  const auth = await prisma.salesAuthorization.update({
    where: { id: authorizationId },
    data: { status: "APROBADA", decidedById: ctx.user.id, decidedAt: new Date(), decisionNotes: notes?.trim() || null },
    select: { workspaceId: true, salesOrderId: true, trigger: true },
  });
  await prisma.activity.create({
    data: { workspaceId: auth.workspaceId, type: "AUTHORIZATION_DECIDED", description: `Autorización de venta aprobada (${auth.trigger})`, metadata: { salesOrderId: auth.salesOrderId } },
  });
  await logAuditEvent({
    actorUserId: ctx.user.id, actorName: ctx.user.name,
    workspaceId: auth.workspaceId, workspaceName: ctx.workspace.name,
    action: "SALES_AUTHORIZATION_APPROVED", details: { salesOrderId: auth.salesOrderId, trigger: auth.trigger },
  });
  revalidatePath(`/ordenes-venta/${auth.salesOrderId}`);
}

export async function rejectAuthorization(authorizationId: string, notes: string) {
  if (!notes.trim()) throw new Error("Rechazar una autorización requiere un motivo.");
  const ctx = await requireAdmin();
  const auth = await prisma.salesAuthorization.update({
    where: { id: authorizationId },
    data: { status: "RECHAZADA", decidedById: ctx.user.id, decidedAt: new Date(), decisionNotes: notes.trim() },
    select: { workspaceId: true, salesOrderId: true, trigger: true },
  });
  await prisma.activity.create({
    data: { workspaceId: auth.workspaceId, type: "AUTHORIZATION_DECIDED", description: `Autorización de venta rechazada (${auth.trigger}) — ${notes.trim()}`, metadata: { salesOrderId: auth.salesOrderId } },
  });
  await logAuditEvent({
    actorUserId: ctx.user.id, actorName: ctx.user.name,
    workspaceId: auth.workspaceId, workspaceName: ctx.workspace.name,
    action: "SALES_AUTHORIZATION_REJECTED", details: { salesOrderId: auth.salesOrderId, trigger: auth.trigger, notes: notes.trim() },
  });
  revalidatePath(`/ordenes-venta/${auth.salesOrderId}`);
}

// ── Reglas de autorización (Configuración) ──────────────────────────────
type RuleInput = {
  name: string;
  trigger: AuthorizationTrigger;
  discountPercentThreshold?: number | null;
  amountThreshold?: number | null;
  requiredApproverRole?: "ADMIN_DEALER" | "SUPER_ADMIN";
};

export async function createAuthorizationRule(workspaceId: string, data: RuleInput) {
  await requireAdmin();
  await prisma.authorizationRule.create({
    data: {
      workspaceId, name: data.name.trim(), trigger: data.trigger,
      discountPercentThreshold: data.discountPercentThreshold ?? null,
      amountThreshold: data.amountThreshold ?? null,
      requiredApproverRole: data.requiredApproverRole ?? "ADMIN_DEALER",
    },
  });
  revalidatePath("/configuracion");
}

export async function updateAuthorizationRule(id: string, data: RuleInput) {
  await requireAdmin();
  await prisma.authorizationRule.update({
    where: { id },
    data: {
      name: data.name.trim(), trigger: data.trigger,
      discountPercentThreshold: data.discountPercentThreshold ?? null,
      amountThreshold: data.amountThreshold ?? null,
      requiredApproverRole: data.requiredApproverRole ?? "ADMIN_DEALER",
    },
  });
  revalidatePath("/configuracion");
}

export async function toggleAuthorizationRuleActive(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.authorizationRule.update({ where: { id }, data: { isActive } });
  revalidatePath("/configuracion");
}

export async function deleteAuthorizationRule(id: string) {
  await requireAdmin();
  await prisma.authorizationRule.delete({ where: { id } });
  revalidatePath("/configuracion");
}
