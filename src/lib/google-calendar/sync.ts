import { prisma } from "@/lib/prisma";
import { getValidAccessToken, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "./client";

/** Crea o actualiza el evento espejo en Google Calendar. No-op si el workspace no tiene la integración conectada. */
export async function syncAppointmentToGoogle(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { workspace: { select: { timezone: true } } },
  });
  if (!appointment) return;

  const accessToken = await getValidAccessToken(appointment.workspaceId).catch(() => null);
  if (!accessToken) return;

  const event = {
    title: appointment.title,
    description: appointment.notes,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    location: appointment.location,
    timeZone: appointment.workspace.timezone,
  };

  try {
    if (appointment.googleEventId) {
      await updateCalendarEvent(accessToken, appointment.googleEventId, event);
    } else {
      const eventId = await createCalendarEvent(accessToken, event);
      await prisma.appointment.update({ where: { id: appointment.id }, data: { googleEventId: eventId } });
    }
  } catch (err) {
    console.error("Fallo sincronizando cita con Google Calendar:", err);
  }
}

/** Borra el evento espejo en Google Calendar (cancelación o borrado de la cita en el CRM). */
export async function deleteAppointmentFromGoogle(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment?.googleEventId) return;

  const accessToken = await getValidAccessToken(appointment.workspaceId).catch(() => null);
  if (!accessToken) return;

  await deleteCalendarEvent(accessToken, appointment.googleEventId).catch((err) => {
    console.error("Fallo eliminando cita de Google Calendar:", err);
  });
}
