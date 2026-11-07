import type Anthropic from "@anthropic-ai/sdk";
import type { ActionContext } from "@/lib/actions/types";
import { scheduleTask } from "@/lib/jobs/scheduled-tasks";
import { executeWorkflowTriggers } from "./workflow-trigger";

type FollowupStep = { id: string; value: number; unit: "Minutes" | "Hours" | "Days"; letAiSend: boolean; triggerWorkflow: boolean };
type FollowupScenario = { id: string; name: string; enabled: boolean; followUps: FollowupStep[] };

export function enabledFollowupScenarios(actionsConfig: Record<string, unknown> | undefined): FollowupScenario[] {
  const config = actionsConfig?.AUTO_FOLLOWUP as { scenarios?: FollowupScenario[] } | undefined;
  return (config?.scenarios ?? []).filter((s) => s.enabled && s.followUps?.length);
}

function stepDelayMs(step: FollowupStep): number {
  const perUnit = step.unit === "Minutes" ? 60_000 : step.unit === "Days" ? 86_400_000 : 3_600_000;
  return step.value * perUnit;
}

/**
 * Tool dinámica NO terminal — a diferencia de escalate_to_human/stop_bot, no corta
 * el loop ni reemplaza la respuesta: el agente sigue respondiendo normal en el mismo
 * turno mientras de fondo programa el recordatorio proactivo.
 */
export function buildFollowupTool(actionsConfig: Record<string, unknown>, actions: string[]): Anthropic.Tool | null {
  if (!actions.includes("AUTO_FOLLOWUP")) return null;
  const scenarios = enabledFollowupScenarios(actionsConfig);
  if (!scenarios.length) return null;

  return {
    name: "schedule_followup",
    description:
      "Programa un mensaje de seguimiento proactivo para más adelante, SIN interrumpir tu respuesta normal de este turno. " +
      "Úsala SOLO cuando la situación coincida claramente con uno de estos escenarios: " +
      scenarios.map((s) => `"${s.name}"`).join("; ") + ".",
    input_schema: {
      type: "object",
      properties: {
        scenarioId: { type: "string", enum: scenarios.map((s) => s.id), description: "El escenario que mejor coincide con la situación actual" },
      },
      required: ["scenarioId"],
    },
  };
}

export function isFollowupTool(name: string): boolean {
  return name === "schedule_followup";
}

export async function executeFollowupTool(input: unknown, ctx: ActionContext): Promise<void> {
  if (!ctx.conversationId || !ctx.agentId) return;
  const scenarios = enabledFollowupScenarios(ctx.actionsConfig);
  const scenarioId = (input as { scenarioId?: string } | undefined)?.scenarioId;
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  const step = scenario?.followUps[0];
  if (!scenario || !step) return;

  await scheduleTask({
    workspaceId: ctx.workspaceId,
    type: "FOLLOWUP_STEP",
    payload: { conversationId: ctx.conversationId, agentId: ctx.agentId, scenarioId: scenario.id, followupIndex: 0 },
    runAt: new Date(Date.now() + stepDelayMs(step)),
    dedupeKey: `followup:${ctx.conversationId}`,
  });
}

/**
 * Ejecuta un paso de la secuencia de follow-up: opcionalmente manda un mensaje
 * generado por la IA, opcionalmente dispara los workflows configurados en
 * "Trigger a Workflow", y si quedan más pasos en el escenario, reprograma el
 * siguiente con el mismo dedupeKey (así se sigue pudiendo cancelar con un
 * solo cancelScheduledTask si el cliente responde).
 */
export async function runFollowupStep(
  ctx: ActionContext,
  actionsConfig: Record<string, unknown>,
  scenarioId: string,
  followupIndex: number,
  sendReply: () => Promise<void>
) {
  const scenarios = enabledFollowupScenarios(actionsConfig);
  const scenario = scenarios.find((s) => s.id === scenarioId);
  const step = scenario?.followUps[followupIndex];
  if (!scenario || !step || !ctx.conversationId || !ctx.agentId) return;

  if (step.letAiSend) await sendReply();
  if (step.triggerWorkflow) await executeWorkflowTriggers(actionsConfig, ctx.workspaceId, ctx.leadId, ctx.conversationId);

  const nextStep = scenario.followUps[followupIndex + 1];
  if (nextStep) {
    await scheduleTask({
      workspaceId: ctx.workspaceId,
      type: "FOLLOWUP_STEP",
      payload: { conversationId: ctx.conversationId, agentId: ctx.agentId, scenarioId, followupIndex: followupIndex + 1 },
      runAt: new Date(Date.now() + stepDelayMs(nextStep)),
      dedupeKey: `followup:${ctx.conversationId}`,
    });
  }
}
