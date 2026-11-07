"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";

async function requireAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx || (ctx.role !== "ADMIN_DEALER" && !ctx.isSuperAdmin)) {
    throw new Error("Solo un Admin Dealer puede hacer esto.");
  }
  return ctx;
}

// ── Reglas de comisión ──────────────────────────────────
export async function createCommissionRule(
  workspaceId: string,
  data: { name: string; calcType: "PERCENT_OF_VALUE" | "PERCENT_OF_MARGIN" | "FIXED_AMOUNT"; percent?: number | null; fixedAmount?: number | null }
) {
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
  data: { name: string; calcType: "PERCENT_OF_VALUE" | "PERCENT_OF_MARGIN" | "FIXED_AMOUNT"; percent?: number | null; fixedAmount?: number | null }
) {
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
  await requireAdmin();
  await prisma.commissionRule.update({ where: { id }, data: { isActive } });
  revalidatePath("/comisiones");
}

export async function deleteCommissionRule(id: string) {
  await requireAdmin();
  await prisma.commissionRule.delete({ where: { id } });
  revalidatePath("/comisiones");
}

// ── Comisiones ───────────────────────────────────────────
export async function approveCommission(commissionId: string) {
  const ctx = await requireAdmin();
  await prisma.commission.update({
    where: { id: commissionId },
    data: { status: "APPROVED", approvedByUserId: ctx.user.id, approvedAt: new Date(), rejectionReason: null },
  });
  revalidatePath("/comisiones");
}

export async function rejectCommission(commissionId: string, reason: string) {
  const ctx = await requireAdmin();
  await prisma.commission.update({
    where: { id: commissionId },
    data: { status: "REJECTED", approvedByUserId: ctx.user.id, approvedAt: new Date(), rejectionReason: reason.trim() || null },
  });
  revalidatePath("/comisiones");
}

export async function markCommissionPaid(commissionId: string) {
  await requireAdmin();
  await prisma.commission.update({
    where: { id: commissionId },
    data: { status: "PAID", paidAt: new Date() },
  });
  revalidatePath("/comisiones");
}
