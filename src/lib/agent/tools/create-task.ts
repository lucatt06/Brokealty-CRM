import { prisma } from "@/lib/prisma";
import type { Priority } from "@prisma/client";
import type { AgentToolDefinition } from "../types";

const PRIORITIES = ["BAJA", "MEDIA", "ALTA", "URGENTE"];

export const createTaskTool: AgentToolDefinition = {
  key: "create_task",
  anthropicSchema: {
    name: "create_task",
    description: "Crea una tarea para el equipo de ventas relacionada con el contacto actual.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título de la tarea" },
        description: { type: "string", description: "Detalle opcional de la tarea" },
        dueAt: { type: "string", description: "Fecha límite en formato ISO 8601 (opcional)" },
        priority: { type: "string", enum: PRIORITIES, description: "Prioridad de la tarea" },
      },
      required: ["title"],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { title: string; description?: string; dueAt?: string; priority?: string };
    if (!input.title?.trim()) return "El título de la tarea es obligatorio.";

    let dueAt: Date | null = null;
    if (input.dueAt) {
      dueAt = new Date(input.dueAt);
      if (isNaN(dueAt.getTime())) return "La fecha límite proporcionada no es válida.";
    }

    await prisma.task.create({
      data: {
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        title: input.title.trim(),
        description: input.description || null,
        dueAt,
        priority: (PRIORITIES.includes(input.priority ?? "") ? input.priority : "MEDIA") as Priority,
      },
    });

    return "Tarea creada correctamente.";
  },
};
