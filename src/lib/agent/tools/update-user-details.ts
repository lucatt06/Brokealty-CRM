import { prisma } from "@/lib/prisma";
import type { AgentToolDefinition } from "../types";

const FIELD_KEYS = ["source", "stage", "vehicleInterest", "budget", "custom"];

export const updateUserDetailsTool: AgentToolDefinition = {
  key: "update_user_details",
  anthropicSchema: {
    name: "update_user_details",
    description: "Guarda información verificada del contacto en su ficha de lead (no usar para nombre, email o teléfono).",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", enum: FIELD_KEYS, description: "Campo a actualizar" },
        value: { type: "string", description: "Valor a guardar" },
      },
      required: ["field", "value"],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { field: string; value: string };
    if (!ctx.leadId) return "No hay un contacto asociado a esta conversación; no se puede actualizar.";
    const value = input.value?.trim();
    if (!value) return "El valor no puede estar vacío.";

    switch (input.field) {
      case "source":
        await prisma.lead.update({ where: { id: ctx.leadId }, data: { sourceDetail: value } });
        break;
      case "stage":
        await prisma.lead.update({ where: { id: ctx.leadId }, data: { stage: value } });
        break;
      case "vehicleInterest":
        await prisma.lead.update({ where: { id: ctx.leadId }, data: { desiredModel: value } });
        break;
      case "budget": {
        const num = Number(value.replace(/[^0-9.]/g, ""));
        if (isNaN(num)) return "No pude interpretar el presupuesto como un número.";
        await prisma.lead.update({ where: { id: ctx.leadId }, data: { budgetMax: num } });
        break;
      }
      default: {
        const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId }, select: { notes: true } });
        const nextNotes = [lead?.notes, `${input.field}: ${value}`].filter(Boolean).join("\n");
        await prisma.lead.update({ where: { id: ctx.leadId }, data: { notes: nextNotes } });
      }
    }

    return `Campo "${input.field}" actualizado correctamente.`;
  },
};
