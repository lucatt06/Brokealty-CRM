import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { AI_MODELS } from "@/lib/ai-models";
import { buildSystemPrompt } from "./prompt";
import { buildAnthropicTools, executeTool } from "./tool-registry";
import { buildBehaviorTools, isBehaviorTool, executeBehaviorTool } from "./behavior";
import { buildFollowupTool, isFollowupTool, executeFollowupTool } from "./followup";
import { buildWorkflowTriggerTool, isWorkflowTriggerTool, executeWorkflowTriggerTool } from "./workflow-trigger";
import { runToolCallingLoop, ToolLoopError, type ToolCallOutcome, type ToolLoopResult } from "./tool-loop";
import { getWorkspaceAiKey } from "@/lib/integrations/ai-keys";
import { logAiUsage } from "@/lib/ai-usage";
import { fireAutomationTrigger } from "@/lib/jobs/run-automations";
import type { ActionContext } from "@/lib/actions/types";

export type OrchestratorResult =
  | { reply: string; toolCalls: string[]; messageId: string; error?: undefined }
  | { reply?: undefined; toolCalls?: undefined; messageId?: undefined; error: string };

type CoalesceMessage = { direction: string; content: string; mediaUrl: string | null; mediaType: string | null };

/**
 * Agrupa mensajes consecutivos del mismo direction en un solo turno. Necesario
 * porque, con el buffer de respuesta (varios INBOUND pueden llegar antes de que
 * el agente responda), la API de Anthropic exige alternancia estricta user/assistant.
 *
 * Si el mensaje entrante trae una imagen o documento y el agente tiene el toggle
 * correspondiente activo (respondToImages/respondToPdfs), se adjunta como bloque
 * multimodal para que el modelo la "vea" de verdad, no solo el placeholder de texto.
 */
function coalesceMessages(
  msgs: CoalesceMessage[],
  caps: { respondToImages: boolean; respondToPdfs: boolean }
): Anthropic.Messages.MessageParam[] {
  const grouped: { role: "user" | "assistant"; blocks: Anthropic.Messages.ContentBlockParam[] }[] = [];

  for (const m of msgs) {
    const role: "user" | "assistant" = m.direction === "INBOUND" ? "user" : "assistant";
    const blocks: Anthropic.Messages.ContentBlockParam[] = [];

    const canAttach = role === "user" && m.mediaUrl && (
      (m.mediaType === "image" && caps.respondToImages) ||
      (m.mediaType === "document" && caps.respondToPdfs)
    );
    if (canAttach) {
      blocks.push(
        m.mediaType === "image"
          ? { type: "image", source: { type: "url", url: m.mediaUrl! } }
          : { type: "document", source: { type: "url", url: m.mediaUrl! } }
      );
    }
    if (m.content) blocks.push({ type: "text", text: m.content });
    if (!blocks.length) continue;

    const last = grouped[grouped.length - 1];
    if (last && last.role === role) {
      last.blocks.push(...blocks);
    } else {
      grouped.push({ role, blocks });
    }
  }

  return grouped.map(({ role, blocks }) => {
    if (blocks.length === 1 && blocks[0].type === "text") return { role, content: blocks[0].text };
    return { role, content: blocks };
  });
}

type AgentPrep =
  | { ok: false; error: string }
  | {
      ok: true;
      agent: NonNullable<Awaited<ReturnType<typeof prisma.aIAgent.findUnique>>>;
      usedSharedKey: boolean;
      system: string;
      anthropicTools: Anthropic.Tool[];
      client: Anthropic;
      resolvedModel: string;
      actionsConfig: Record<string, unknown>;
    };

/** Carga y arma todo lo que runAgentTurn/runAgentFollowup necesitan del agente — system prompt, tools, cliente. */
async function prepareAgentTurn(agentId: string): Promise<AgentPrep> {
  const agent = await prisma.aIAgent.findUnique({ where: { id: agentId } });
  if (!agent) return { ok: false, error: "Agente no encontrado." };
  if (agent.status !== "AUTO_PILOT") return { ok: false, error: "El agente no está en modo Auto Pilot." };

  const ownKey = await getWorkspaceAiKey(agent.workspaceId, "ANTHROPIC");
  const usedSharedKey = !ownKey;
  const apiKey = ownKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Configura una API key de Anthropic en Integraciones (o ANTHROPIC_API_KEY en .env.local) para activar el motor del agente." };
  }

  const [workspace, knowledgeItems, assignedTools] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: agent.workspaceId } }),
    agent.knowledgeBaseIds.length
      ? prisma.knowledgeBaseItem.findMany({ where: { knowledgeBaseId: { in: agent.knowledgeBaseIds } } })
      : Promise.resolve([]),
    agent.assignedToolIds.length
      ? prisma.agentTool.findMany({ where: { id: { in: agent.assignedToolIds } } })
      : Promise.resolve([]),
  ]);

  const actionsConfig = (agent.actionsConfig ?? {}) as Record<string, unknown>;
  const system = buildSystemPrompt(
    {
      personality: agent.personality,
      goal: agent.goal,
      additionalInfo: agent.additionalInfo,
      businessName: agent.businessName,
      actions: agent.actions,
      actionsConfig,
    },
    workspace?.name ?? "",
    knowledgeItems
  );

  // book_appointment no vive en el Tool Kit (es parte de la acción "Appointment Booking"
  // configurada aparte), así que se habilita automáticamente cuando esa acción está activa.
  const toolKeys = new Set(assignedTools.map((t) => t.key));
  if (agent.actions.includes("APPOINTMENT_BOOKING")) toolKeys.add("book_appointment");
  const behaviorTools = buildBehaviorTools(actionsConfig, agent.actions);
  const followupTool = buildFollowupTool(actionsConfig, agent.actions);
  const workflowTool = buildWorkflowTriggerTool(actionsConfig, agent.actions);
  const anthropicTools = [
    ...buildAnthropicTools([...toolKeys]),
    ...behaviorTools,
    ...(followupTool ? [followupTool] : []),
    ...(workflowTool ? [workflowTool] : []),
  ];

  const resolvedModel = agent.model in AI_MODELS ? agent.model : "claude-sonnet-5";
  return { ok: true, agent, usedSharedKey, system, anthropicTools, client: new Anthropic({ apiKey }), resolvedModel, actionsConfig };
}

function makeToolCallExecutor(ctx: ActionContext) {
  return async (block: Anthropic.Messages.ToolUseBlock): Promise<ToolCallOutcome> => {
    if (isBehaviorTool(block.name)) {
      const result = await executeBehaviorTool(block.name as "escalate_to_human" | "stop_bot", block.input, ctx);
      return { content: result ? "ok" : "Escenario no encontrado.", terminal: !!result, terminalMessage: result?.finalMessage };
    }
    if (isFollowupTool(block.name)) {
      await executeFollowupTool(block.input, ctx);
      return { content: "ok" };
    }
    if (isWorkflowTriggerTool(block.name)) {
      const content = await executeWorkflowTriggerTool(block.input, ctx);
      return { content };
    }
    const content = await executeTool(block.name, block.input, ctx);
    return { content };
  };
}

async function logUsageIfAny(agent: { workspaceId: string; id: string }, resolvedModel: string, usedSharedKey: boolean, loop: { totalInputTokens: number; totalOutputTokens: number }) {
  if (!loop.totalInputTokens && !loop.totalOutputTokens) return;
  await logAiUsage({
    workspaceId: agent.workspaceId, agentId: agent.id, provider: "ANTHROPIC", model: resolvedModel,
    inputTokens: loop.totalInputTokens, outputTokens: loop.totalOutputTokens, usedSharedKey,
  });
}

export async function runAgentTurn(agentId: string, conversationId: string): Promise<OrchestratorResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
  if (!conversation) return { error: "Conversación no encontrada." };
  if (!conversation.isAiHandled) return { error: "Esta conversación no está siendo manejada por el bot (isAiHandled = false)." };
  if (!conversation.messages.length) return { error: "La conversación no tiene mensajes todavía." };

  const prep = await prepareAgentTurn(agentId);
  if (!prep.ok) return { error: prep.error };
  const { agent, usedSharedKey, system, anthropicTools, client, resolvedModel, actionsConfig } = prep;

  const messages = coalesceMessages(conversation.messages, { respondToImages: agent.respondToImages, respondToPdfs: agent.respondToPdfs });
  const ctx: ActionContext = { workspaceId: agent.workspaceId, leadId: conversation.leadId, conversationId, agentId: agent.id, actionsConfig };

  let loop: ToolLoopResult;
  try {
    loop = await runToolCallingLoop({ client, model: resolvedModel, system, tools: anthropicTools, messages, executeToolCall: makeToolCallExecutor(ctx) });
  } catch (e) {
    if (e instanceof ToolLoopError) {
      await logUsageIfAny(agent, resolvedModel, usedSharedKey, e);
      return { error: e.message };
    }
    throw e;
  }

  const finalText = loop.finalText || "Entendido, dame un momento para confirmarte los detalles.";

  const outboundMessage = await prisma.message.create({
    data: { conversationId, direction: "OUTBOUND", channel: conversation.channel, content: finalText, senderId: null },
  });
  await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
  await logUsageIfAny(agent, resolvedModel, usedSharedKey, loop);

  // El agente puede agendar citas por su cuenta (tool book_appointment) — dispara
  // APPOINTMENT_CREATED igual que cualquier otro punto de creación de citas.
  if (loop.toolCalls.includes("book_appointment") && conversation.leadId) {
    await fireAutomationTrigger(agent.workspaceId, "APPOINTMENT_CREATED", { leadId: conversation.leadId, conversationId });
  }

  return { reply: finalText, toolCalls: loop.toolCalls, messageId: outboundMessage.id };
}

/**
 * Variante proactiva para Auto Follow-up: no hay un mensaje entrante nuevo al
 * que responder, así que se agrega una instrucción interna pidiéndole al modelo
 * que retome la conversación. A diferencia de runAgentTurn, si el modelo no
 * produce texto no se manda nada (no tiene sentido un fallback genérico como
 * mensaje proactivo fuera de contexto).
 */
export async function runAgentFollowup(agentId: string, conversationId: string): Promise<OrchestratorResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
  if (!conversation) return { error: "Conversación no encontrada." };
  if (!conversation.isAiHandled) return { error: "Esta conversación no está siendo manejada por el bot (isAiHandled = false)." };

  const prep = await prepareAgentTurn(agentId);
  if (!prep.ok) return { error: prep.error };
  const { agent, usedSharedKey, system, anthropicTools, client, resolvedModel, actionsConfig } = prep;

  const messages = coalesceMessages(conversation.messages, { respondToImages: agent.respondToImages, respondToPdfs: agent.respondToPdfs });
  messages.push({
    role: "user",
    content:
      "[Instrucción interna del sistema — el contacto NO escribió esto]: pasó un tiempo sin respuesta del contacto. " +
      "Escribe un mensaje de seguimiento breve, natural y no invasivo para retomar la conversación donde quedó.",
  });

  const ctx: ActionContext = { workspaceId: agent.workspaceId, leadId: conversation.leadId, conversationId, agentId: agent.id, actionsConfig };

  let loop: ToolLoopResult;
  try {
    loop = await runToolCallingLoop({ client, model: resolvedModel, system, tools: anthropicTools, messages, executeToolCall: makeToolCallExecutor(ctx) });
  } catch (e) {
    if (e instanceof ToolLoopError) {
      await logUsageIfAny(agent, resolvedModel, usedSharedKey, e);
      return { error: e.message };
    }
    throw e;
  }

  await logUsageIfAny(agent, resolvedModel, usedSharedKey, loop);
  if (!loop.finalText) return { error: "El modelo no generó un mensaje de seguimiento." };

  const outboundMessage = await prisma.message.create({
    data: { conversationId, direction: "OUTBOUND", channel: conversation.channel, content: loop.finalText, senderId: null },
  });
  await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });

  return { reply: loop.finalText, toolCalls: loop.toolCalls, messageId: outboundMessage.id };
}
