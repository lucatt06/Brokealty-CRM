import { prisma } from "@/lib/prisma";
import type { ActionDefinition } from "../types";

export const changeStageAction: ActionDefinition = {
  key: "change_stage",
  anthropicSchema: {
    name: "change_stage",
    description: "Cambia la etapa del pipeline del contacto.",
    input_schema: {
      type: "object",
      properties: { stage: { type: "string", description: "Nombre exacto de la etapa destino" } },
      required: ["stage"],
    },
  },
  execute: async (rawInput, ctx) => {
    if (!ctx.leadId) return "No hay contacto asociado.";
    const input = rawInput as { stage?: string };
    const stageName = String(input.stage ?? "").trim();
    if (!stageName) return "Nombre de etapa vacío.";

    const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId }, select: { pipelineId: true } });
    if (!lead) return "Contacto no encontrado.";

    // Si el lead está en un pipeline, valida que la etapa exista en ese pipeline
    // antes de escribirla (antes se aceptaba cualquier string sin validar).
    if (lead.pipelineId) {
      const stage = await prisma.pipelineStage.findFirst({ where: { pipelineId: lead.pipelineId, name: stageName } });
      if (!stage) return `La etapa "${stageName}" no existe en el pipeline de este lead.`;
    }

    await prisma.lead.update({ where: { id: ctx.leadId }, data: { stage: stageName } });
    return `Etapa cambiada a "${stageName}".`;
  },
};
