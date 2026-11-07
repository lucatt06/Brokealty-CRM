import { prisma } from "@/lib/prisma";
import type { AppointmentType } from "@prisma/client";
import type { AgentToolDefinition } from "../types";

const VALID_TYPES = ["VISITA_DEALER", "LLAMADA", "VIDEO_LLAMADA", "TEST_DRIVE", "ENTREGA", "SEGUIMIENTO"];

export const bookAppointmentTool: AgentToolDefinition = {
  key: "book_appointment",
  anthropicSchema: {
    name: "book_appointment",
    description: "Agenda una cita en el calendario de citas del dealer para el contacto actual.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: VALID_TYPES, description: "Tipo o propósito de la cita" },
        startAt: { type: "string", description: "Fecha y hora de inicio en formato ISO 8601, ej. 2026-07-10T15:00:00-04:00" },
        durationMinutes: { type: "number", description: "Duración en minutos. Por defecto 60." },
        title: { type: "string", description: "Título breve de la cita" },
        notes: { type: "string", description: "Notas adicionales para la cita" },
      },
      required: ["type", "startAt"],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { type: string; startAt: string; durationMinutes?: number; title?: string; notes?: string };

    if (!VALID_TYPES.includes(input.type)) {
      return `Tipo de cita inválido. Usa uno de: ${VALID_TYPES.join(", ")}.`;
    }

    const startAt = new Date(input.startAt);
    if (isNaN(startAt.getTime())) return "La fecha/hora proporcionada no es válida.";

    const cfg = ctx.actionsConfig?.APPOINTMENT_BOOKING as { minNoticeHours?: number } | undefined;
    const minNoticeHours = cfg?.minNoticeHours ?? 0;
    const hoursUntil = (startAt.getTime() - Date.now()) / 3_600_000;
    if (hoursUntil < minNoticeHours) {
      return `No se puede agendar con menos de ${minNoticeHours} horas de anticipación. Ofrece un horario más adelante.`;
    }

    const endAt = new Date(startAt.getTime() + (input.durationMinutes ?? 60) * 60_000);

    const appointment = await prisma.appointment.create({
      data: {
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        title: input.title?.trim() || `Cita — ${input.type}`,
        type: input.type as AppointmentType,
        startAt,
        endAt,
        notes: input.notes || null,
      },
    });

    if (ctx.leadId) {
      await prisma.activity.create({
        data: {
          workspaceId: ctx.workspaceId,
          leadId: ctx.leadId,
          type: "APPOINTMENT_CREATED",
          description: `Cita agendada por el agente IA para ${startAt.toLocaleString("es-DO")}`,
        },
      });
    }

    return `Cita agendada correctamente para ${startAt.toLocaleString("es-DO")} (id: ${appointment.id}).`;
  },
};
