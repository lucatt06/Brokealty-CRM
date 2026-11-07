import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import type { ToolContext } from "./types";
import { scheduleTask } from "@/lib/jobs/scheduled-tasks";

type BehaviorScenario = {
  id: string; name: string; enabled: boolean;
  triggerCondition: string; examplePhrases: string[]; finalMessage: string; tagIds: string[];
  assignToUserId?: string; createTask?: boolean;
  reactivateEnabled?: boolean; reactivateValue?: number; reactivateUnit?: "Minutes" | "Hours" | "Days";
};

function reactivateDelayMs(value: number, unit: string): number {
  const perUnit = unit === "Minutes" ? 60_000 : unit === "Days" ? 86_400_000 : 3_600_000; // default Hours
  return value * perUnit;
}

function enabledScenarios(actionsConfig: Record<string, unknown>, key: string): BehaviorScenario[] {
  const config = actionsConfig[key] as { scenarios?: BehaviorScenario[] } | undefined;
  return (config?.scenarios ?? []).filter((s) => s.enabled);
}

/**
 * Construye tools dinámicas (no viven en el Tool Registry porque su schema depende
 * de los escenarios configurados por cada agente) para que el modelo pueda escalar a
 * un humano o detenerse a sí mismo cuando reconozca alguno de los escenarios definidos.
 */
export function buildBehaviorTools(actionsConfig: Record<string, unknown>, actions: string[]): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [];

  if (actions.includes("HUMAN_HANDOVER")) {
    const scenarios = enabledScenarios(actionsConfig, "HUMAN_HANDOVER");
    if (scenarios.length) {
      tools.push({
        name: "escalate_to_human",
        description:
          "Transfiere esta conversación a un miembro humano del equipo. Úsala SOLO cuando el mensaje del cliente coincida claramente con uno de estos escenarios: " +
          scenarios.map((s) => `"${s.name}" (${s.triggerCondition}${s.examplePhrases.length ? `, ej: ${s.examplePhrases.join(" / ")}` : ""})`).join("; ") + ".",
        input_schema: {
          type: "object",
          properties: {
            scenarioId: { type: "string", enum: scenarios.map((s) => s.id), description: "El escenario que mejor coincide con la situación actual" },
          },
          required: ["scenarioId"],
        },
      });
    }
  }

  if (actions.includes("STOP_BOT")) {
    const scenarios = enabledScenarios(actionsConfig, "STOP_BOT");
    if (scenarios.length) {
      tools.push({
        name: "stop_bot",
        description:
          "Detiene tus respuestas automáticas en esta conversación. Úsala SOLO cuando el mensaje del cliente coincida claramente con uno de estos escenarios: " +
          scenarios.map((s) => `"${s.name}" (${s.triggerCondition}${s.examplePhrases.length ? `, ej: ${s.examplePhrases.join(" / ")}` : ""})`).join("; ") + ".",
        input_schema: {
          type: "object",
          properties: {
            scenarioId: { type: "string", enum: scenarios.map((s) => s.id), description: "El escenario que mejor coincide con la situación actual" },
          },
          required: ["scenarioId"],
        },
      });
    }
  }

  return tools;
}

export function isBehaviorTool(name: string): boolean {
  return name === "escalate_to_human" || name === "stop_bot";
}

/**
 * Ejecuta escalate_to_human / stop_bot: apaga isAiHandled, aplica etiquetas,
 * asigna/crea tarea (solo handover), y devuelve el finalMessage exacto configurado
 * por el admin para que se use como respuesta — no se deja que el modelo lo parafrasee.
 */
export async function executeBehaviorTool(
  name: "escalate_to_human" | "stop_bot",
  input: unknown,
  ctx: ToolContext
): Promise<{ finalMessage: string } | null> {
  if (!ctx.conversationId) return null;

  const key = name === "escalate_to_human" ? "HUMAN_HANDOVER" : "STOP_BOT";
  const scenarios = enabledScenarios(ctx.actionsConfig ?? {}, key);
  const scenarioId = (input as { scenarioId?: string } | undefined)?.scenarioId;
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  if (!scenario) return null;

  await prisma.conversation.update({
    where: { id: ctx.conversationId },
    data: {
      isAiHandled: false,
      ...(name === "escalate_to_human" && scenario.assignToUserId ? { assignedTo: scenario.assignToUserId } : {}),
    },
  });

  if (ctx.leadId) {
    if (name === "escalate_to_human" && scenario.createTask) {
      await prisma.task.create({
        data: {
          workspaceId: ctx.workspaceId,
          leadId: ctx.leadId,
          title: `Escalado por IA: ${scenario.name}`,
          description: scenario.triggerCondition,
          priority: "ALTA",
          assignedTo: scenario.assignToUserId || null,
        },
      });
    }
    if (scenario.tagIds?.length) {
      await prisma.lead.update({
        where: { id: ctx.leadId },
        data: { tags: { connect: scenario.tagIds.map((id) => ({ id })) } },
      }).catch(() => {});
    }
  }

  if (scenario.reactivateEnabled && scenario.reactivateValue) {
    await scheduleTask({
      workspaceId: ctx.workspaceId,
      type: "CONVERSATION_REACTIVATE",
      payload: { conversationId: ctx.conversationId },
      runAt: new Date(Date.now() + reactivateDelayMs(scenario.reactivateValue, scenario.reactivateUnit ?? "Hours")),
      dedupeKey: `reactivate:${ctx.conversationId}`,
    });
  }

  return { finalMessage: scenario.finalMessage };
}
