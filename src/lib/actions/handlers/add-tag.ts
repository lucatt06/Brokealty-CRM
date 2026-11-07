import { prisma } from "@/lib/prisma";
import type { ActionDefinition } from "../types";

export const addTagAction: ActionDefinition = {
  key: "add_tag",
  anthropicSchema: {
    name: "add_tag",
    description: "Agrega una etiqueta al contacto (la crea si no existe todavía en el workspace).",
    input_schema: {
      type: "object",
      properties: { tag: { type: "string", description: "Nombre de la etiqueta" } },
      required: ["tag"],
    },
  },
  execute: async (rawInput, ctx) => {
    if (!ctx.leadId) return "No hay contacto asociado.";
    const input = rawInput as { tag?: string };
    const name = String(input.tag ?? "").trim();
    if (!name) return "Nombre de etiqueta vacío.";

    // upsert: si la etiqueta no existe todavía en el workspace, se crea (antes
    // esto era un no-op silencioso si el tag no existía de antemano).
    const tag = await prisma.tag.upsert({
      where: { workspaceId_name: { workspaceId: ctx.workspaceId, name } },
      update: {},
      create: { workspaceId: ctx.workspaceId, name },
    });
    await prisma.lead.update({ where: { id: ctx.leadId }, data: { tags: { connect: { id: tag.id } } } });
    return `Etiqueta "${name}" agregada.`;
  },
};
