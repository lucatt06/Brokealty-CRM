"use server";

import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { listRecentAuditLogs, type AuditLogEntry } from "@/lib/audit";
import { listUsageByWorkspace, type WorkspaceUsageSummary } from "@/lib/ai-usage";

async function requireSuperAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx?.isSuperAdmin) throw new Error("Solo un Super Admin puede ver esto.");
  return ctx;
}

export type SuperAdminOverview = {
  tenantsTotal: number;
  tenantsActive: number;
  tenantsSuspended: number;
  leadsTotal: number;
  conversationsTotal: number;
  usageByWorkspace: WorkspaceUsageSummary[];
  auditLog: AuditLogEntry[];
  tenants: { id: string; name: string; slug: string; plan: string; isActive: boolean; leads: number; conversations: number }[];
};

export async function getSuperAdminOverview(): Promise<SuperAdminOverview> {
  await requireSuperAdmin();

  const [workspaces, leadsTotal, conversationsTotal, usageByWorkspace, auditLog] = await Promise.all([
    prisma.workspace.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, slug: true, plan: true, isActive: true,
        _count: { select: { leads: true, conversations: true } },
      },
    }),
    prisma.lead.count(),
    prisma.conversation.count(),
    listUsageByWorkspace(30),
    listRecentAuditLogs(20),
  ]);

  return {
    tenantsTotal: workspaces.length,
    tenantsActive: workspaces.filter((w) => w.isActive).length,
    tenantsSuspended: workspaces.filter((w) => !w.isActive).length,
    leadsTotal,
    conversationsTotal,
    usageByWorkspace,
    auditLog,
    tenants: workspaces.map((w) => ({
      id: w.id, name: w.name, slug: w.slug, plan: w.plan, isActive: w.isActive,
      leads: w._count.leads, conversations: w._count.conversations,
    })),
  };
}
