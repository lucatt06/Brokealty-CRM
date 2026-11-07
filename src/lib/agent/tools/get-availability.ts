import { prisma } from "@/lib/prisma";
import type { AgentToolDefinition } from "../types";

export const getAvailabilityTool: AgentToolDefinition = {
  key: "get_availability",
  anthropicSchema: {
    name: "get_availability",
    description: "Consulta las citas ya agendadas en una fecha para saber qué horarios están ocupados antes de proponer uno nuevo.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Fecha a consultar en formato YYYY-MM-DD" },
      },
      required: ["date"],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { date: string };
    const day = new Date(`${input.date}T00:00:00`);
    if (isNaN(day.getTime())) return "La fecha proporcionada no es válida.";

    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);

    const appointments = await prisma.appointment.findMany({
      where: { workspaceId: ctx.workspaceId, startAt: { gte: start, lte: end }, status: { notIn: ["CANCELADA", "NO_SHOW"] } },
      orderBy: { startAt: "asc" },
      select: { startAt: true, endAt: true, type: true },
    });

    if (!appointments.length) return `No hay citas agendadas el ${input.date}. Todo el día está disponible.`;

    const busy = appointments
      .map((a) => `${a.startAt.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })} - ${a.endAt.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })} (${a.type})`)
      .join("\n");
    return `Horarios ocupados el ${input.date}:\n${busy}`;
  },
};
