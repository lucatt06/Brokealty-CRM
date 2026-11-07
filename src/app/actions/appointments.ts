"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fireAutomationTrigger } from "@/lib/jobs/run-automations";
import { syncAppointmentToGoogle, deleteAppointmentFromGoogle } from "@/lib/google-calendar/sync";

type ApptType = "VISITA_PROPIEDAD" | "LLAMADA" | "VIDEO_LLAMADA" | "FIRMA_CONTRATO" | "ENTREGA_LLAVES" | "SEGUIMIENTO";
type ApptStatus = "AGENDADA" | "CONFIRMADA" | "COMPLETADA" | "CANCELADA" | "NO_SHOW";

export async function createAppointmentCalendar(data: {
  workspaceId: string;
  title: string;
  type: ApptType;
  startAt: string;
  endAt: string;
  leadId?: string | null;
  notes?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  assignedTo?: string | null;
}) {
  const appointment = await prisma.appointment.create({
    data: {
      workspaceId: data.workspaceId,
      title: data.title,
      type: data.type,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      leadId: data.leadId || null,
      notes: data.notes || null,
      location: data.location || null,
      meetingUrl: data.meetingUrl || null,
      assignedTo: data.assignedTo || null,
    },
  });
  if (data.leadId) {
    await fireAutomationTrigger(data.workspaceId, "APPOINTMENT_CREATED", { leadId: data.leadId });
  }
  await syncAppointmentToGoogle(appointment.id);
  revalidatePath("/calendarios");
  revalidatePath("/conversaciones");
}

export async function updateAppointmentCalendar(id: string, data: {
  title?: string;
  type?: ApptType;
  startAt?: string;
  endAt?: string;
  notes?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  leadId?: string | null;
  assignedTo?: string | null;
}) {
  await prisma.appointment.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.type && { type: data.type }),
      ...(data.startAt && { startAt: new Date(data.startAt) }),
      ...(data.endAt && { endAt: new Date(data.endAt) }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.meetingUrl !== undefined && { meetingUrl: data.meetingUrl }),
      ...(data.leadId !== undefined && { leadId: data.leadId }),
      ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
    },
  });
  await syncAppointmentToGoogle(id);
  revalidatePath("/calendarios");
  revalidatePath("/conversaciones");
}

export async function updateApptStatus(id: string, status: ApptStatus) {
  await prisma.appointment.update({ where: { id }, data: { status } });
  if (status === "CANCELADA") await deleteAppointmentFromGoogle(id);
  revalidatePath("/calendarios");
  revalidatePath("/conversaciones");
}

export async function deleteAppointment(id: string) {
  await deleteAppointmentFromGoogle(id);
  await prisma.appointment.delete({ where: { id } });
  revalidatePath("/calendarios");
  revalidatePath("/conversaciones");
}
