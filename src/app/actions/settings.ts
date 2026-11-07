"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendInviteEmail } from "@/lib/auth/tokens";

// ── Workspace (General) ─────────────────────────────────────────

export async function updateWorkspaceGeneral(workspaceId: string, data: {
  name: string; logoUrl: string | null; currency: string; timezone: string;
  whatsappNumber: string | null; facebookPageId: string | null; instagramHandle: string | null;
}) {
  await prisma.workspace.update({ where: { id: workspaceId }, data });
  revalidatePath("/configuracion");
  revalidatePath("/", "layout");
}

// ── Mi Perfil ────────────────────────────────────────────────────

export async function updateMyProfile(userId: string, data: { name: string; phone: string | null; avatarUrl: string | null }) {
  await prisma.user.update({ where: { id: userId }, data });
  revalidatePath("/configuracion");
  revalidatePath("/", "layout");
}

// ── Equipo ───────────────────────────────────────────────────────

export async function listTeamMembers(workspaceId: string) {
  const rows = await prisma.workspaceUser.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
}

export async function inviteTeamMember(workspaceId: string, email: string, name: string, role: "ADMIN_DEALER" | "VENDEDOR") {
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

export async function updateMemberRole(workspaceUserId: string, role: "ADMIN_DEALER" | "VENDEDOR") {
  await prisma.workspaceUser.update({ where: { id: workspaceUserId }, data: { role } });
  revalidatePath("/configuracion");
}

export async function toggleMemberActive(workspaceUserId: string, isActive: boolean) {
  await prisma.workspaceUser.update({ where: { id: workspaceUserId }, data: { isActive } });
  revalidatePath("/configuracion");
}
