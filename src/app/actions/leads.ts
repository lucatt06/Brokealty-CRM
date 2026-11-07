"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fireAutomationTrigger } from "@/lib/jobs/run-automations";

// ── Notas ────────────────────────────────────────────────
export async function addNote(workspaceId: string, leadId: string, content: string) {
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
  await prisma.task.create({
    data: { workspaceId, leadId, title, priority, dueAt: dueAt ? new Date(dueAt) : null },
  });
  revalidatePath("/conversaciones");
}

export async function toggleTask(taskId: string, done: boolean) {
  await prisma.task.update({
    where: { id: taskId },
    data: { status: done ? "COMPLETADA" : "PENDIENTE", completedAt: done ? new Date() : null },
  });
  revalidatePath("/conversaciones");
}

export async function deleteTask(taskId: string) {
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
  await prisma.appointment.create({
    data: {
      workspaceId, leadId, title,
      type: type as "VISITA_DEALER" | "LLAMADA" | "VIDEO_LLAMADA" | "TEST_DRIVE" | "ENTREGA" | "SEGUIMIENTO",
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
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
  revalidatePath("/conversaciones");
}

// ── Detalle de lead (página completa) ───────────────────
export async function updateLeadAssignee(leadId: string, userId: string | null) {
  await prisma.lead.update({ where: { id: leadId }, data: { assignedTo: userId } });
  revalidatePath("/leads");
}

export async function addTagToLead(workspaceId: string, leadId: string, tagName: string) {
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
  await prisma.lead.update({ where: { id: leadId }, data: { tags: { disconnect: { id: tagId } } } });
  revalidatePath("/leads");
}

export async function deactivateLead(leadId: string) {
  await prisma.lead.update({ where: { id: leadId }, data: { isActive: false } });
  revalidatePath("/leads");
}
