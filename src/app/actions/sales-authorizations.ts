"use server";

import { AuthError, assertOwns, assertWorkspace, requireAdminCtx, requireCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { logAuditEvent } from "@/lib/audit";
import type { AuthorizationTrigger } from "@prisma/client";

async function requireAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx || (ctx.role !== "ADMIN" && !ctx.isSuperAdmin)) {
    throw new Error("Solo un Administrador puede aprobar o rechazar autorizaciones de venta.");
  }
  return ctx;
}

export async function approveAuthorization(authorizationId: string, notes?: string) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("authorization", authorizationId, ctx0.workspace.id);
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
  const ctx0 = await requireAdminCtx();
  await assertOwns("authorization", authorizationId, ctx0.workspace.id);
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
  requiredApproverRole?: "ADMIN" | "SUPER_ADMIN";
};

export async function createAuthorizationRule(workspaceId: string, data: RuleInput) {
  const ctx0 = await requireAdminCtx();
  assertWorkspace(ctx0, workspaceId);
  await requireAdmin();
  await prisma.authorizationRule.create({
    data: {
      workspaceId, name: data.name.trim(), trigger: data.trigger,
      discountPercentThreshold: data.discountPercentThreshold ?? null,
      amountThreshold: data.amountThreshold ?? null,
      requiredApproverRole: data.requiredApproverRole ?? "ADMIN",
    },
  });
  revalidatePath("/configuracion");
}

export async function updateAuthorizationRule(id: string, data: RuleInput) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("authorizationRule", id, ctx0.workspace.id);
  await requireAdmin();
  await prisma.authorizationRule.update({
    where: { id },
    data: {
      name: data.name.trim(), trigger: data.trigger,
      discountPercentThreshold: data.discountPercentThreshold ?? null,
      amountThreshold: data.amountThreshold ?? null,
      requiredApproverRole: data.requiredApproverRole ?? "ADMIN",
    },
  });
  revalidatePath("/configuracion");
}

export async function toggleAuthorizationRuleActive(id: string, isActive: boolean) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("authorizationRule", id, ctx0.workspace.id);
  await requireAdmin();
  await prisma.authorizationRule.update({ where: { id }, data: { isActive } });
  revalidatePath("/configuracion");
}

export async function deleteAuthorizationRule(id: string) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("authorizationRule", id, ctx0.workspace.id);
  await requireAdmin();
  await prisma.authorizationRule.delete({ where: { id } });
  revalidatePath("/configuracion");
}
