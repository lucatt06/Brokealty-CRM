import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import type { ActionDefinition } from "../types";
import { getWorkspaceAiKey } from "@/lib/integrations/ai-keys";
import { runToolCallingLoop, ToolLoopError } from "@/lib/agent/tool-loop";

/**
 * Nivel 2 de "IA en automatizaciones": la IA decide y ejecuta acciones por su
 * cuenta (mismo loop de tool-calling que el agente conversacional), pero
 * limitada a una lista blanca de acciones (allowedActionKeys) que elige quien
 * crea la automatización — mismo patrón que assignedToolIds en los agentes.
 * Cada ejecución queda registrada en Activity para auditoría.
 */
export const aiAgentStepAction: ActionDefinition = {
  key: "ai_agent_step",
  execute: async (rawInput, ctx) => {
    const input = rawInput as { instruction?: string; allowedActionKeys?: string[] };
    const instruction = String(input.instruction ?? "").trim();
    const allowedActionKeys = Array.isArray(input.allowedActionKeys) ? input.allowedActionKeys.map(String) : [];
    if (!instruction) return "Falta la instrucción para el paso autónomo de IA.";
    if (!allowedActionKeys.length) return "El paso no tiene ninguna acción permitida configurada (allowedActionKeys vacío).";

    const apiKey = (await getWorkspaceAiKey(ctx.workspaceId, "ANTHROPIC")) ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return "Configura una API key de Anthropic en Integraciones (o ANTHROPIC_API_KEY en .env.local).";

    // Import diferido: src/lib/actions/registry.ts es quien registra este mismo
    // archivo — importarlo arriba del todo crearía un ciclo de módulos. En
    // tiempo de ejecución (no de carga) ya no hay problema.
    const { buildAnthropicTools, executeTool } = await import("../registry");
    const tools = buildAnthropicTools(allowedActionKeys);

    const lead = ctx.leadId ? await prisma.lead.findUnique({ where: { id: ctx.leadId } }) : null;

    const client = new Anthropic({ apiKey });
    const messages: Anthropic.Messages.MessageParam[] = [
      {
        role: "user",
        content: `Contacto: ${lead ? `${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}` : "sin contacto asociado"}.\n\nInstrucción: ${instruction}`,
      },
    ];

    let loop;
    try {
      loop = await runToolCallingLoop({
        client,
        model: "claude-sonnet-5",
        system:
          "Eres un asistente autónomo de un CRM para dealers de vehículos, ejecutando un paso de una automatización. " +
          "Decide qué acciones tomar, usando solo las herramientas disponibles, para cumplir la instrucción. " +
          "No estás hablando con el cliente — solo actúa usando las herramientas.",
        tools,
        messages,
        executeToolCall: async (block) => ({ content: await executeTool(block.name, block.input, ctx) }),
      });
    } catch (e) {
      if (e instanceof ToolLoopError) return `Error ejecutando el paso autónomo: ${e.message}`;
      throw e;
    }

    await prisma.activity.create({
      data: {
        workspaceId: ctx.workspaceId,
        leadId: ctx.leadId,
        type: "AI_ACTION",
        description: `Paso autónomo de IA (automatización): ${loop.toolCalls.length ? loop.toolCalls.join(", ") : "sin acciones"}`,
        metadata: { automationId: ctx.automationId ?? null, toolCalls: loop.toolCalls, reasoning: loop.finalText },
      },
    });

    return `Ejecutado. Acciones tomadas: ${loop.toolCalls.join(", ") || "ninguna"}.`;
  },
};
