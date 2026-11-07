import { prisma } from "@/lib/prisma";
import type { ScheduledTask, ScheduledTaskType } from "@prisma/client";
import { runAgentTurn, runAgentFollowup } from "@/lib/agent/orchestrator";
import { runFollowupStep } from "@/lib/agent/followup";
import { sendOutboundWhatsApp } from "@/lib/messaging/send-outbound";
import { executeAutomationActions } from "./run-automations";
import type { ActionContext } from "@/lib/actions/types";
import { sendMessageAction } from "@/lib/actions/handlers/send-message";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;
const RETRY_BACKOFF_MS = 60_000;

type ScheduledTaskHandler = (task: ScheduledTask) => Promise<void>;

type AgentReplyBufferPayload = { conversationId: string; agentId: string };

/**
 * Un handler por ScheduledTaskType. Cada fase posterior (reactivación, follow-up,
 * WAIT de automatizaciones) añade el suyo aquí.
 */
export const SCHEDULED_TASK_HANDLERS: Partial<Record<ScheduledTaskType, ScheduledTaskHandler>> = {
  AGENT_REPLY_BUFFER: async (task) => {
    const payload = task.payload as AgentReplyBufferPayload;
    // isAiHandled/AUTO_PILOT ya se revalidan dentro de runAgentTurn — si un humano
    // tomó control mientras se esperaba, la tarea simplemente no produce respuesta.
    const result = await runAgentTurn(payload.agentId, payload.conversationId);
    if (!result.reply) return;

    const conversation = await prisma.conversation.findUnique({ where: { id: payload.conversationId } });
    if (!conversation || (conversation.channel !== "WHATSAPP_PERSONAL" && conversation.channel !== "WHATSAPP") || !conversation.externalId) return;

    const { externalId } = await sendOutboundWhatsApp({
      workspaceId: conversation.workspaceId,
      channel: conversation.channel,
      externalId: conversation.externalId,
      text: result.reply,
    });
    if (externalId && result.messageId) {
      await prisma.message.update({ where: { id: result.messageId }, data: { externalId } });
    }
  },

  CONVERSATION_REACTIVATE: async (task) => {
    const payload = task.payload as { conversationId: string };
    await prisma.conversation.update({ where: { id: payload.conversationId }, data: { isAiHandled: true } });
  },

  AUTOMATION_WAIT_RESUME: async (task) => {
    const payload = task.payload as {
      automationId: string; leadId: string; conversationId: string | null; nextActionIndex: number;
    };
    const automation = await prisma.automation.findUnique({
      where: { id: payload.automationId },
      include: { actions: { orderBy: { order: "asc" } } },
    });
    if (!automation) return;
    const lead = await prisma.lead.findUnique({ where: { id: payload.leadId }, include: { conversations: true } });
    if (!lead) return;
    const conversation = payload.conversationId ? lead.conversations.find((c) => c.id === payload.conversationId) : undefined;
    await executeAutomationActions(automation, payload.nextActionIndex, lead, conversation, automation.workspaceId);
  },

  FOLLOWUP_STEP: async (task) => {
    const payload = task.payload as { conversationId: string; agentId: string; scenarioId: string; followupIndex: number };
    const [conversation, agent] = await Promise.all([
      prisma.conversation.findUnique({ where: { id: payload.conversationId } }),
      prisma.aIAgent.findUnique({ where: { id: payload.agentId } }),
    ]);
    if (!conversation || !agent) return;
    // Si un humano tomó control mientras se esperaba, la secuencia muere aquí
    // (no se manda nada y no se reprograma el siguiente paso).
    if (!conversation.isAiHandled) return;

    const actionsConfig = (agent.actionsConfig ?? {}) as Record<string, unknown>;
    const ctx: ActionContext = {
      workspaceId: agent.workspaceId, leadId: conversation.leadId,
      conversationId: conversation.id, agentId: agent.id, actionsConfig,
    };

    await runFollowupStep(ctx, actionsConfig, payload.scenarioId, payload.followupIndex, async () => {
      const result = await runAgentFollowup(agent.id, conversation.id);
      if (!result.reply) return;
      if ((conversation.channel !== "WHATSAPP_PERSONAL" && conversation.channel !== "WHATSAPP") || !conversation.externalId) return;

      const { externalId } = await sendOutboundWhatsApp({
        workspaceId: agent.workspaceId,
        channel: conversation.channel,
        externalId: conversation.externalId,
        text: result.reply,
      });
      if (externalId && result.messageId) {
        await prisma.message.update({ where: { id: result.messageId }, data: { externalId } });
      }
    });
  },

  MATCH_INVERSO_TIMEOUT: async (task) => {
    const payload = task.payload as { leadId: string; vehicleId: string; taskId: string };
    const [lead, vehicle, matchTask] = await Promise.all([
      prisma.lead.findUnique({ where: { id: payload.leadId } }),
      prisma.vehicle.findUnique({ where: { id: payload.vehicleId } }),
      prisma.task.findUnique({ where: { id: payload.taskId } }),
    ]);
    if (!lead || !vehicle) return;
    // El vendedor completó la tarea a tiempo -> ya actuó, no hace falta avisarle al lead directo.
    if (matchTask?.status === "COMPLETADA") return;
    // El vehículo ya no está disponible (se vendió/reservó mientras tanto) -> ya no aplica.
    if (vehicle.status !== "DISPONIBLE") return;
    if (!lead.phone) return;

    // No todos los leads tienen conversación de WhatsApp todavía (solo se crea hoy
    // cuando el contacto escribe primero) — si no existe, se crea una nueva usando
    // el teléfono guardado, mismo formato de JID que usa el webhook a la inversa.
    let conversation = await prisma.conversation.findFirst({
      where: { workspaceId: lead.workspaceId, leadId: lead.id, channel: "WHATSAPP_PERSONAL" },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          workspaceId: lead.workspaceId, leadId: lead.id, channel: "WHATSAPP_PERSONAL",
          externalId: `${lead.phone}@s.whatsapp.net`, status: "OPEN", isAiHandled: true,
        },
      });
    }
    if (!conversation.externalId) return;

    const content = `¡Hola ${lead.firstName}! Tenemos disponible el ${vehicle.make} ${vehicle.model} ${vehicle.year} que buscabas. ¿Te gustaría más información o agendar una visita?`;
    await sendMessageAction.execute({ content }, {
      workspaceId: lead.workspaceId, leadId: lead.id, conversationId: conversation.id, agentId: null,
    });
  },
};

export async function runScheduledTasksSweep() {
  const due = await prisma.scheduledTask.findMany({
    where: { status: "PENDING", runAt: { lte: new Date() } },
    orderBy: { runAt: "asc" },
    take: BATCH_SIZE,
  });

  let processed = 0;
  let failed = 0;

  for (const task of due) {
    // Lock optimista: si dos invocaciones del cron se solapan, solo una gana
    // el "PENDING -> PROCESSING" y la otra la salta.
    const locked = await prisma.scheduledTask.updateMany({
      where: { id: task.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    if (locked.count !== 1) continue;

    const handler = SCHEDULED_TASK_HANDLERS[task.type];
    try {
      if (!handler) throw new Error(`Sin handler registrado para ScheduledTaskType "${task.type}"`);
      await handler(task);
      await prisma.scheduledTask.update({
        where: { id: task.id },
        data: { status: "DONE", processedAt: new Date() },
      });
      processed++;
    } catch (e) {
      const attempts = task.attempts + 1;
      const lastError = e instanceof Error ? e.message : "error desconocido";
      if (attempts >= MAX_ATTEMPTS) {
        await prisma.scheduledTask.update({
          where: { id: task.id },
          data: { status: "FAILED", attempts, lastError },
        });
      } else {
        await prisma.scheduledTask.update({
          where: { id: task.id },
          data: { status: "PENDING", attempts, lastError, runAt: new Date(Date.now() + RETRY_BACKOFF_MS) },
        });
      }
      failed++;
    }
  }

  return { checked: due.length, processed, failed };
}
