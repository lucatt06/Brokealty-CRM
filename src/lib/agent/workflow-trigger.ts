import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { executeAutomationActions } from "@/lib/jobs/run-automations";

type WorkflowTrigger = { id: string; name: string; workflowIds: string[]; condition: string };
type TriggerWorkflowConfig = { triggers: WorkflowTrigger[] };

function configuredTriggers(actionsConfig: Record<string, unknown> | undefined): WorkflowTrigger[] {
  const config = actionsConfig?.TRIGGER_WORKFLOW as TriggerWorkflowConfig | undefined;
  return config?.triggers ?? [];
}

async function runWorkflowIds(workflowIds: string[], workspaceId: string, leadId: string | null, conversationId: string | null) {
  if (!leadId || !workflowIds.length) return;
  const [automations, lead] = await Promise.all([
    prisma.automation.findMany({ where: { id: { in: workflowIds }, isActive: true }, include: { actions: { orderBy: { order: "asc" } } } }),
    prisma.lead.findUnique({ where: { id: leadId }, include: { conversations: true } }),
  ]);
  if (!lead) return;
  const conversation = conversationId ? lead.conversations.find((c) => c.id === conversationId) : lead.conversations[0];
  for (const automation of automations) {
    await executeAutomationActions(automation, 0, lead, conversation, workspaceId);
  }
}

/** Corre TODOS los workflows configurados en "Trigger a Workflow" — usado por Auto Follow-up cuando un paso trae triggerWorkflow=true (no hay una condición específica que evaluar ahí, ya se decidió al agendar el follow-up). */
export async function executeWorkflowTriggers(
  actionsConfig: Record<string, unknown>,
  workspaceId: string,
  leadId: string | null,
  conversationId: string | null
) {
  const workflowIds = [...new Set(configuredTriggers(actionsConfig).flatMap((t) => t.workflowIds))];
  await runWorkflowIds(workflowIds, workspaceId, leadId, conversationId);
}

/**
 * Tool dinámica NO terminal — igual que schedule_followup, el agente sigue
 * respondiendo normal mientras de fondo corre el/los workflows del disparador elegido.
 */
export function buildWorkflowTriggerTool(actionsConfig: Record<string, unknown>, actions: string[]): Anthropic.Tool | null {
  if (!actions.includes("TRIGGER_WORKFLOW")) return null;
  const triggers = configuredTriggers(actionsConfig).filter((t) => t.workflowIds.length);
  if (!triggers.length) return null;

  return {
    name: "trigger_workflow",
    description:
      "Dispara una o más automatizaciones configuradas por el equipo, sin interrumpir tu respuesta de este turno. " +
      "Úsala SOLO cuando la situación coincida con una de estas condiciones: " +
      triggers.map((t) => `"${t.name}" (${t.condition || "sin condición específica"})`).join("; ") + ".",
    input_schema: {
      type: "object",
      properties: {
        triggerId: { type: "string", enum: triggers.map((t) => t.id), description: "El disparador que mejor coincide con la situación actual" },
      },
      required: ["triggerId"],
    },
  };
}

export function isWorkflowTriggerTool(name: string): boolean {
  return name === "trigger_workflow";
}

export async function executeWorkflowTriggerTool(
  input: unknown,
  ctx: { workspaceId: string; leadId: string | null; conversationId: string | null; actionsConfig?: Record<string, unknown> }
): Promise<string> {
  const triggerId = (input as { triggerId?: string } | undefined)?.triggerId;
  const triggers = configuredTriggers(ctx.actionsConfig);
  const trigger = triggers.find((t) => t.id === triggerId) ?? triggers[0];
  if (!trigger) return "Disparador no encontrado.";

  await runWorkflowIds(trigger.workflowIds, ctx.workspaceId, ctx.leadId, ctx.conversationId);
  return `Workflow "${trigger.name}" disparado.`;
}
