import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { KanbanBoard } from "@/components/pipeline/kanban-board";

export default async function NegociosPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const [pipeline, leads, vehicles, workspaceUsers] = await Promise.all([
    prisma.pipeline.findFirst({
      where: { workspaceId },
      include: {
        stages: { orderBy: { order: "asc" } },
        deals: {
          include: {
            lead: {
              select: {
                id: true, firstName: true, lastName: true, phone: true,
                activities: {
                  select: { id: true, type: true, description: true, createdAt: true },
                  orderBy: { createdAt: "desc" },
                  take: 60,
                },
              },
            },
            vehicle: { select: { id: true, make: true, model: true, year: true } },
            stage: { select: { id: true, name: true, color: true, order: true, probability: true } },
            assignedTo: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.lead.findMany({
      where: { workspaceId },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.vehicle.findMany({
      where: { workspaceId },
      select: { id: true, make: true, model: true, year: true, priceDOP: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.workspaceUser.findMany({
      where: { workspaceId },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  if (!pipeline) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">No hay un pipeline configurado aún.</p>
      </div>
    );
  }

  const serialized = {
    ...pipeline,
    deals: pipeline.deals.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      closedAt: d.closedAt?.toISOString() ?? null,
      expectedCloseAt: d.expectedCloseAt?.toISOString() ?? null,
      lead: {
        ...d.lead,
        activities: d.lead.activities.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    })),
  };

  const users = workspaceUsers.map((wu) => wu.user);

  return (
    <KanbanBoard
      pipeline={serialized}
      workspaceId={workspaceId}
      leads={leads}
      vehicles={vehicles}
      users={users}
    />
  );
}
