import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { TasksClient } from "@/components/tareas/tasks-client";

export default async function TareasPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const [tasks, leads, workspaceUsers] = await Promise.all([
    prisma.task.findMany({
      where: { workspaceId },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.findMany({
      where: { workspaceId },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.workspaceUser.findMany({
      where: { workspaceId },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const serialized = tasks.map((t) => ({
    ...t,
    dueAt: t.dueAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const users = workspaceUsers.map((wu) => wu.user);

  return (
    <TasksClient
      tasks={serialized}
      leads={leads}
      users={users}
      workspaceId={workspaceId}
    />
  );
}
