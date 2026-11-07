import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/current-user";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export type ActiveWorkspaceContext = {
  workspace: { id: string; name: string; slug: string; logoUrl: string | null };
  user: { id: string; name: string; email: string };
  role: string;
  isSuperAdmin: boolean;
};

/**
 * Resuelve el tenant activo de la sesión actual:
 * - Super Admin: puede estar viendo cualquier workspace (elegido vía cookie, con
 *   fallback al primero disponible) — es cross-workspace por diseño.
 * - Admin Dealer / Vendedor: siempre su único workspace, la cookie no aplica.
 */
export const getActiveWorkspace = cache(async (): Promise<ActiveWorkspaceContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  // Una sola query trae todas las membresías del usuario (con su workspace) — antes esto
  // eran 2-3 round-trips secuenciales a la DB en cada navegación (chequeo de super admin +
  // resolución de workspace por separado). Se decide todo en JS con este único resultado.
  const memberships = await prisma.workspaceUser.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });
  const isSuperAdmin = memberships.some((m) => m.role === "SUPER_ADMIN");

  if (isSuperAdmin) {
    const cookieStore = await cookies();
    const selectedId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;

    // Caso común (sin cookie, o cookie apunta a un tenant del que ya es miembro): resuelto
    // sin queries extra. Solo si el Super Admin está viendo un tenant ajeno (sin membresía
    // propia ahí) hace falta una query adicional puntual.
    let resolved = selectedId ? memberships.find((m) => m.workspaceId === selectedId)?.workspace : undefined;
    if (!resolved && selectedId) {
      resolved = (await prisma.workspace.findUnique({ where: { id: selectedId } })) ?? undefined;
    }
    if (!resolved) {
      resolved = memberships[0]?.workspace ?? (await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } })) ?? undefined;
    }
    if (!resolved) return null;

    return {
      workspace: { id: resolved.id, name: resolved.name, slug: resolved.slug, logoUrl: resolved.logoUrl },
      user: { id: user.id, name: user.name, email: user.email },
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
    };
  }

  const membership = memberships.find((m) => m.isActive);
  if (!membership) return null;

  return {
    workspace: { id: membership.workspace.id, name: membership.workspace.name, slug: membership.workspace.slug, logoUrl: membership.workspace.logoUrl },
    user: { id: user.id, name: user.name, email: user.email },
    role: membership.role,
    isSuperAdmin: false,
  };
});

export async function listAllWorkspacesForSwitcher() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, logoUrl: true, isActive: true, plan: true },
  });
  return workspaces;
}
