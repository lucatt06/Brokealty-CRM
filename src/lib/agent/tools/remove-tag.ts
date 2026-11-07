import { prisma } from "@/lib/prisma";
import type { AgentToolDefinition } from "../types";

export const removeTagTool: AgentToolDefinition = {
  key: "remove_tag",
  anthropicSchema: {
    name: "remove_tag",
    description: "Quita una etiqueta del contacto/lead actual.",
    input_schema: {
      type: "object",
      properties: {
        tagName: { type: "string", description: "Nombre exacto de la etiqueta a quitar" },
      },
      required: ["tagName"],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { tagName: string };
    if (!ctx.leadId) return "No hay un contacto asociado a esta conversación.";

    const tag = await prisma.tag.findFirst({ where: { workspaceId: ctx.workspaceId, name: input.tagName } });
    if (!tag) return `No existe una etiqueta llamada "${input.tagName}" en este workspace.`;

    await prisma.lead.update({ where: { id: ctx.leadId }, data: { tags: { disconnect: { id: tag.id } } } });
    return `Etiqueta "${input.tagName}" removida del contacto.`;
  },
};
