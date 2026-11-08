"use server";

import { cleanDisplayName } from "@/lib/leads/contact-name";
import { assertMember, assertOwns, assertWorkspace, requireCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fireAutomationTrigger } from "@/lib/jobs/run-automations";

// ── Notas ────────────────────────────────────────────────
export async function addNote(workspaceId: string, leadId: string, content: string) {
  const ctx = await requireCtx();
  assertWorkspace(ctx, workspaceId);
  await assertOwns("lead", leadId, ctx.workspace.id);
  await prisma.activity.create({
    data: { workspaceId, leadId, type: "NOTE_ADDED", description: content },
  });
  revalidatePath("/conversaciones");
}

// ── Tareas ───────────────────────────────────────────────
export async function createTask(
  workspaceId: string,
  leadId: string,
  title: string,
  priority: "BAJA" | "MEDIA" | "ALTA" | "URGENTE",
  dueAt: string | null,
) {
  const ctx = await requireCtx();
  assertWorkspace(ctx, workspaceId);
  await assertOwns("lead", leadId, ctx.workspace.id);
  await prisma.task.create({
    data: { workspaceId, leadId, title, priority, dueAt: dueAt ? new Date(dueAt) : null },
  });
  revalidatePath("/conversaciones");
}

export async function toggleTask(taskId: string, done: boolean) {
  const ctx = await requireCtx();
  await assertOwns("task", taskId, ctx.workspace.id);
  await prisma.task.update({
    where: { id: taskId },
    data: { status: done ? "COMPLETADA" : "PENDIENTE", completedAt: done ? new Date() : null },
  });
  revalidatePath("/conversaciones");
}

export async function deleteTask(taskId: string) {
  const ctx = await requireCtx();
  await assertOwns("task", taskId, ctx.workspace.id);
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/conversaciones");
}

// ── Citas ────────────────────────────────────────────────
export async function createAppointment(
  workspaceId: string,
  leadId: string,
  title: string,
  type: string,
  startAt: string,
  endAt: string,
  notes?: string,
) {
  const ctx = await requireCtx();
  assertWorkspace(ctx, workspaceId);
  await assertOwns("lead", leadId, ctx.workspace.id);
  await prisma.appointment.create({
    data: {
      workspaceId, leadId, title,
      type: type as "VISITA_PROPIEDAD" | "LLAMADA" | "VIDEO_LLAMADA" | "FIRMA_CONTRATO" | "ENTREGA_LLAVES" | "SEGUIMIENTO",
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      notes: notes || null,
    },
  });
  await fireAutomationTrigger(workspaceId, "APPOINTMENT_CREATED", { leadId });
  revalidatePath("/conversaciones");
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "AGENDADA" | "CONFIRMADA" | "COMPLETADA" | "CANCELADA" | "NO_SHOW",
) {
  const ctx = await requireCtx();
  await assertOwns("appointment", appointmentId, ctx.workspace.id);
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
  revalidatePath("/conversaciones");
}

// ── Detalle de lead (página completa) ───────────────────
export async function updateLeadAssignee(leadId: string, userId: string | null) {
  const ctx = await requireCtx();
  await assertOwns("lead", leadId, ctx.workspace.id);
  await assertMember(userId, ctx.workspace.id);
  await prisma.lead.update({ where: { id: leadId }, data: { assignedTo: userId } });
  revalidatePath("/leads");
}

export async function addTagToLead(workspaceId: string, leadId: string, tagName: string) {
  const ctx = await requireCtx();
  assertWorkspace(ctx, workspaceId);
  await assertOwns("lead", leadId, ctx.workspace.id);
  const name = tagName.trim();
  if (!name) return;
  const tag = await prisma.tag.upsert({
    where: { workspaceId_name: { workspaceId, name } },
    update: {},
    create: { workspaceId, name },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { tags: { connect: { id: tag.id } } } });
  revalidatePath("/leads");
}

export async function removeTagFromLead(leadId: string, tagId: string) {
  const ctx = await requireCtx();
  await assertOwns("lead", leadId, ctx.workspace.id);
  await assertOwns("tag", tagId, ctx.workspace.id);
  await prisma.lead.update({ where: { id: leadId }, data: { tags: { disconnect: { id: tagId } } } });
  revalidatePath("/leads");
}

export async function deactivateLead(leadId: string) {
  const ctx = await requireCtx();
  await assertOwns("lead", leadId, ctx.workspace.id);
  await prisma.lead.update({ where: { id: leadId }, data: { isActive: false } });
  revalidatePath("/leads");
}

/** Edita el nombre del contacto. Devuelve `{ ok, error }` (en producción Next oculta el texto de los errores lanzados). */
export async function updateLeadName(leadId: string, firstName: string, lastName: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireCtx();
  await assertOwns("lead", leadId, ctx.workspace.id);
  const first = cleanDisplayName(firstName);
  const last = cleanDisplayName(lastName) || null;
  if (!first) return { ok: false, error: "El nombre no puede estar vacío." };
  await prisma.lead.update({ where: { id: leadId }, data: { firstName: first, lastName: last } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/conversaciones");
  return { ok: true };
}
