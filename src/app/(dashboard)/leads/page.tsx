import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { LeadsClient } from "@/components/leads/leads-client";
import { Topbar } from "@/components/layout/topbar";

export default async function LeadsPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const [leads, users] = await Promise.all([
    prisma.lead.findMany({
      where: { workspaceId, isActive: true },
      include: {
        assignedUser: { select: { id: true, name: true } },
        deals: {
          include: {
            stage: { select: { id: true, name: true, color: true, order: true } },
            vehicle: { select: { id: true, make: true, model: true, year: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workspaceUser.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const serialized = leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    lastContact: l.lastContact?.toISOString() ?? null,
    scoreUpdatedAt: l.scoreUpdatedAt?.toISOString() ?? null,
    deals: l.deals.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      closedAt: d.closedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Leads" />
      <LeadsClient
        leads={serialized}
        users={users.map((wu) => wu.user)}
        workspaceId={workspaceId}
      />
    </div>
  );
}
