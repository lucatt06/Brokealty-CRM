import { prisma } from "@/lib/prisma";
import type { ActionDefinition } from "../types";

export const notifyTeamAction: ActionDefinition = {
  key: "notify_team",
  anthropicSchema: {
    name: "notify_team",
    description: "Notifica al vendedor asignado del contacto (o a los Admin Dealer si no hay ninguno asignado).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título corto de la notificación" },
        body: { type: "string", description: "Cuerpo de la notificación" },
      },
      required: ["title", "body"],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { title?: string; body?: string };
    const title = String(input.title ?? "Automatización").trim();
    const body = String(input.body ?? "").trim();

    // Prioridad: el vendedor asignado al lead; si no hay lead o no está asignado,
    // se notifica a todos los Admin Dealer del workspace.
    let targetUserIds: string[] = [];
    if (ctx.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId }, select: { assignedTo: true } });
      if (lead?.assignedTo) targetUserIds = [lead.assignedTo];
    }
    if (!targetUserIds.length) {
      const admins = await prisma.workspaceUser.findMany({
        where: { workspaceId: ctx.workspaceId, role: "ADMIN_DEALER", isActive: true },
        select: { userId: true },
      });
      targetUserIds = admins.map((a) => a.userId);
    }
    if (!targetUserIds.length) return "No hay a quién notificar en este workspace.";

    await prisma.notification.createMany({
      data: targetUserIds.map((userId) => ({
        workspaceId: ctx.workspaceId,
        userId,
        leadId: ctx.leadId,
        title,
        body,
        type: "AUTOMATION",
      })),
    });
    return `Equipo notificado (${targetUserIds.length}).`;
  },
};
