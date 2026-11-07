import { prisma } from "@/lib/prisma";
import type { ActionDefinition } from "../types";

export const assignUserAction: ActionDefinition = {
  key: "assign_user",
  anthropicSchema: {
    name: "assign_user",
    description: "Asigna (o desasigna, con userId vacío) el contacto a un usuario del workspace por su id exacto.",
    input_schema: {
      type: "object",
      properties: { userId: { type: "string", description: "Id del usuario a asignar; vacío para desasignar" } },
      required: [],
    },
  },
  execute: async (rawInput, ctx) => {
    if (!ctx.leadId) return "No hay contacto asociado.";
    const input = rawInput as { userId?: string | null };
    const userId = input.userId ? String(input.userId) : null;
    await prisma.lead.update({ where: { id: ctx.leadId }, data: { assignedTo: userId } });
    return userId ? "Lead asignado." : "Lead desasignado.";
  },
};
