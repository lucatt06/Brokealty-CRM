import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { TramitesListClient } from "@/components/post-sale-procedures/tramites-list-client";

export default async function TramitesPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");

  const [procedures, members] = await Promise.all([
    prisma.postSaleProcedure.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        salesOrder: { select: { id: true, orderNumber: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 200,
    }),
    prisma.workspaceUser.findMany({
      where: { workspaceId: ctx.workspace.id, isActive: true },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const serialized = procedures.map((p) => ({
    id: p.id,
    type: p.type,
    typeDetail: p.typeDetail,
    status: p.status,
    dueDate: p.dueDate?.toISOString() ?? null,
    completedAt: p.completedAt?.toISOString() ?? null,
    documentUrl: p.documentUrl,
    salesOrder: p.salesOrder,
    assignedTo: p.assignedTo,
  }));

  return (
    <TramitesListClient
      procedures={serialized}
      members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
    />
  );
}
