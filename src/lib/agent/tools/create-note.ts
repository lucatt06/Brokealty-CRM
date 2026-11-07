import { prisma } from "@/lib/prisma";
import type { AgentToolDefinition } from "../types";

export const createNoteTool: AgentToolDefinition = {
  key: "create_note",
  anthropicSchema: {
    name: "create_note",
    description: "Agrega una nota al historial del contacto/lead actual.",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Contenido de la nota" },
      },
      required: ["content"],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { content: string };
    if (!ctx.leadId) return "No hay un contacto asociado a esta conversación; no se puede agregar la nota.";
    if (!input.content?.trim()) return "El contenido de la nota no puede estar vacío.";

    await prisma.activity.create({
      data: {
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        type: "NOTE_ADDED",
        description: input.content.trim(),
      },
    });

    return "Nota agregada correctamente.";
  },
};
