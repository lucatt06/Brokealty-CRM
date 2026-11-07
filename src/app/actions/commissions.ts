"use server";

import { assertOwns, assertWorkspace, requireAdminCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";

async function requireAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx || (ctx.role !== "ADMIN" && !ctx.isSuperAdmin)) {
    throw new Error("Solo un Administrador puede hacer esto.");
  }
  return ctx;
}

// ── Reglas de comisión ──────────────────────────────────
export async function createCommissionRule(
  workspaceId: string,
  data: { name: string; calcType: "PERCENT_OF_VALUE" | "FIXED_AMOUNT"; percent?: number | null; fixedAmount?: number | null }
) {
  const ctx0 = await requireAdminCtx();
  assertWorkspace(ctx0, workspaceId);
  await requireAdmin();
  await prisma.commissionRule.create({
    data: {
      workspaceId,
      name: data.name.trim(),
      calcType: data.calcType,
      percent: data.percent ?? null,
      fixedAmount: data.fixedAmount ?? null,
    },
  });
  revalidatePath("/comisiones");
}

export async function updateCommissionRule(
  id: string,
  data: { name: string; calcType: "PERCENT_OF_VALUE" | "FIXED_AMOUNT"; percent?: number | null; fixedAmount?: number | null }
) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("commissionRule", id, ctx0.workspace.id);
  await requireAdmin();
  await prisma.commissionRule.update({
    where: { id },
    data: {
      name: data.name.trim(),
      calcType: data.calcType,
      percent: data.percent ?? null,
      fixedAmount: data.fixedAmount ?? null,
    },
  });
  revalidatePath("/comisiones");
}

export async function toggleCommissionRuleActive(id: string, isActive: boolean) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("commissionRule", id, ctx0.workspace.id);
  await requireAdmin();
  await prisma.commissionRule.update({ where: { id }, data: { isActive } });
  revalidatePath("/comisiones");
}

export async function deleteCommissionRule(id: string) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("commissionRule", id, ctx0.workspace.id);
  await requireAdmin();
  await prisma.commissionRule.delete({ where: { id } });
  revalidatePath("/comisiones");
}

// ── Comisiones ───────────────────────────────────────────
export async function approveCommission(commissionId: string) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("commission", commissionId, ctx0.workspace.id);
  const ctx = await requireAdmin();
  await prisma.commission.update({
    where: { id: commissionId },
    data: { status: "APPROVED", approvedByUserId: ctx.user.id, approvedAt: new Date(), rejectionReason: null },
  });
  revalidatePath("/comisiones");
}

export async function rejectCommission(commissionId: string, reason: string) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("commission", commissionId, ctx0.workspace.id);
  const ctx = await requireAdmin();
  await prisma.commission.update({
    where: { id: commissionId },
    data: { status: "REJECTED", approvedByUserId: ctx.user.id, approvedAt: new Date(), rejectionReason: reason.trim() || null },
  });
  revalidatePath("/comisiones");
}

export async function markCommissionPaid(commissionId: string) {
  const ctx0 = await requireAdminCtx();
  await assertOwns("commission", commissionId, ctx0.workspace.id);
  await requireAdmin();
  await prisma.commission.update({
    where: { id: commissionId },
    data: { status: "PAID", paidAt: new Date() },
  });
  revalidatePath("/comisiones");
}
