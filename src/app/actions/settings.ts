"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendInviteEmail } from "@/lib/auth/tokens";
import { AuthError, assertOwns, assertWorkspace, requireAdminCtx, requireCtx } from "@/lib/auth/guards";

/** Los tipos de TS no se validan en runtime: solo estos roles se pueden asignar desde la UI. */
const ASSIGNABLE_ROLES = ["ADMIN", "AGENTE"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
function assertAssignableRole(role: string): asserts role is AssignableRole {
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) throw new AuthError("Rol no válido.");
}

// ── Workspace (General) ─────────────────────────────────────────

export async function updateWorkspaceGeneral(workspaceId: string, data: {
  name: string; logoUrl: string | null; currency: string; timezone: string;
  whatsappNumber: string | null; facebookPageId: string | null; instagramHandle: string | null;
}) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  // Lista blanca explícita: nunca pasar `data` completo (plan, isActive, etc. no se editan aquí).
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      name: data.name,
      logoUrl: data.logoUrl,
      currency: data.currency,
      timezone: data.timezone,
      whatsappNumber: data.whatsappNumber,
      facebookPageId: data.facebookPageId,
      instagramHandle: data.instagramHandle,
    },
  });
  revalidatePath("/configuracion");
  revalidatePath("/", "layout");
}

// ── Mi Perfil ────────────────────────────────────────────────────

export async function updateMyProfile(userId: string, data: { name: string; phone: string | null; avatarUrl: string | null }) {
  const ctx = await requireCtx();
  if (ctx.user.id !== userId) throw new AuthError("Solo puedes editar tu propio perfil.");
  await prisma.user.update({ where: { id: userId }, data: { name: data.name, phone: data.phone, avatarUrl: data.avatarUrl } });
  revalidatePath("/configuracion");
  revalidatePath("/", "layout");
}

// ── Equipo ───────────────────────────────────────────────────────

export async function listTeamMembers(workspaceId: string) {
  const ctx = await requireCtx();
  assertWorkspace(ctx, workspaceId);
  const rows = await prisma.workspaceUser.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
}

export async function inviteTeamMember(workspaceId: string, email: string, name: string, role: "ADMIN" | "AGENTE") {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  assertAssignableRole(role);

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) throw new Error("El correo es obligatorio.");

  const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
  if (existing) {
    const alreadyMember = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existing.id } },
    });
    if (alreadyMember) throw new Error("Este usuario ya es parte del equipo.");
    await prisma.workspaceUser.create({ data: { workspaceId, userId: existing.id, role } });
    revalidatePath("/configuracion");
    return;
  }

  const invitedName = name.trim() || trimmedEmail;
  const created = await prisma.user.create({
    data: {
      email: trimmedEmail,
      name: invitedName,
      workspaces: { create: { workspaceId, role } },
    },
  });
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
  await sendInviteEmail(created.id, trimmedEmail, invitedName, workspace?.name ?? "tu equipo");
  revalidatePath("/configuracion");
}

/** El Super Admin no se gestiona desde la UI del equipo, ni se puede tocar la propia membresía. */
async function loadManageableMember(ctx: Awaited<ReturnType<typeof requireAdminCtx>>, workspaceUserId: string) {
  await assertOwns("workspaceUser", workspaceUserId, ctx.workspace.id);
  const member = await prisma.workspaceUser.findUniqueOrThrow({ where: { id: workspaceUserId }, select: { id: true, role: true, userId: true } });
  if (member.role === "SUPER_ADMIN") throw new AuthError("No se puede modificar a un Super Admin.");
  if (member.userId === ctx.user.id) throw new AuthError("No puedes cambiar tu propio acceso.");
  return member;
}

export async function updateMemberRole(workspaceUserId: string, role: "ADMIN" | "AGENTE") {
  const ctx = await requireAdminCtx();
  assertAssignableRole(role);
  await loadManageableMember(ctx, workspaceUserId);
  await prisma.workspaceUser.update({ where: { id: workspaceUserId }, data: { role } });
  revalidatePath("/configuracion");
}

export async function toggleMemberActive(workspaceUserId: string, isActive: boolean) {
  const ctx = await requireAdminCtx();
  await loadManageableMember(ctx, workspaceUserId);
  await prisma.workspaceUser.update({ where: { id: workspaceUserId }, data: { isActive: !!isActive } });
  revalidatePath("/configuracion");
}
