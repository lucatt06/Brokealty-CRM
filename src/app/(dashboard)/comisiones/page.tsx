import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { ComisionesClient } from "@/components/comisiones/comisiones-client";

export default async function ComisionesPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;
  const isAdmin = ctx.role === "ADMIN" || ctx.isSuperAdmin;

  const [commissions, rules] = await Promise.all([
    prisma.commission.findMany({
      where: { workspaceId, ...(isAdmin ? {} : { userId: ctx.user.id }) },
      include: {
        deal: {
          select: {
            lead: { select: { firstName: true, lastName: true } },
            property: { select: { title: true } },
          },
        },
        user: { select: { id: true, name: true } },
        approvedBy: { select: { name: true } },
        rule: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    isAdmin
      ? prisma.commissionRule.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
  ]);

  const serializedCommissions = commissions.map((c) => ({
    id: c.id,
    dealId: c.dealId,
    leadName: [c.deal.lead.firstName, c.deal.lead.lastName].filter(Boolean).join(" "),
    propertyLabel: c.deal.property ? `${c.deal.property.title}` : null,
    userId: c.user.id,
    userName: c.user.name,
    ruleName: c.rule?.name ?? null,
    baseAmount: c.baseAmount,
    amount: c.amount,
    currency: c.currency,
    status: c.status,
    approvedByName: c.approvedBy?.name ?? null,
    approvedAt: c.approvedAt?.toISOString() ?? null,
    rejectionReason: c.rejectionReason,
    paidAt: c.paidAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  const serializedRules = rules.map((r) => ({
    id: r.id,
    name: r.name,
    calcType: r.calcType,
    percent: r.percent,
    fixedAmount: r.fixedAmount,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <ComisionesClient
      workspaceId={workspaceId}
      isAdmin={isAdmin}
      commissions={serializedCommissions}
      rules={serializedRules}
    />
  );
}
