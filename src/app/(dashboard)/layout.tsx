import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { UnreadBadgeProvider } from "@/components/layout/unread-badge-context";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace, listAllWorkspacesForSwitcher } from "@/lib/auth/active-workspace";

async function getSidebarBadges(workspaceId: string) {
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [unreadConversations, pendingTasks] = await Promise.all([
    // Conversaciones con al menos un mensaje INBOUND no leído
    prisma.conversation.count({
      where: {
        workspaceId,
        messages: {
          some: { isRead: false, direction: "INBOUND" },
        },
      },
    }),
    // Tareas vencidas o de hoy, sin completar ni cancelar
    prisma.task.count({
      where: {
        workspaceId,
        status: { notIn: ["COMPLETADA", "CANCELADA"] },
        dueAt: { not: null, lte: todayEnd },
      },
    }),
  ]);

  return { unreadConversaciones: unreadConversations, pendingTasks };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");

  const [badges, allWorkspaces] = await Promise.all([
    getSidebarBadges(ctx.workspace.id),
    ctx.isSuperAdmin ? listAllWorkspacesForSwitcher() : Promise.resolve(null),
  ]);

  return (
    <UnreadBadgeProvider initialCount={badges.unreadConversaciones}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          badges={badges}
          currentUser={{ name: ctx.user.name, role: ctx.role }}
          workspace={ctx.workspace}
          allWorkspaces={allWorkspaces}
          isSuperAdmin={ctx.isSuperAdmin}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </UnreadBadgeProvider>
  );
}
