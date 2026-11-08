import type Anthropic from "@anthropic-ai/sdk";
import type { ActionDefinition, ActionContext } from "./types";
import { bookAppointmentTool } from "../agent/tools/book-appointment";
import { createNoteTool } from "../agent/tools/create-note";
import { createTaskTool } from "../agent/tools/create-task";
import { getAvailabilityTool } from "../agent/tools/get-availability";
import { updateUserDetailsTool } from "../agent/tools/update-user-details";
import { removeTagTool } from "../agent/tools/remove-tag";
import { searchInventoryTool } from "../agent/tools/search-inventory";
import { sendPropertyPhotosTool } from "../agent/tools/send-property-photos";
import { sendPropertyLocationTool } from "../agent/tools/send-property-location";
import { sendMessageAction } from "./handlers/send-message";
import { addTagAction } from "./handlers/add-tag";
import { changeStageAction } from "./handlers/change-stage";
import { assignUserAction } from "./handlers/assign-user";
import { notifyTeamAction } from "./handlers/notify-team";
import { aiGenerateMessageAction } from "./handlers/ai-generate-message";
import { aiAgentStepAction } from "./handlers/ai-agent-step";

/**
 * Registro único de acciones ejecutables, compartido por el loop de tool-calling
 * del agente conversacional (src/lib/agent/orchestrator.ts) y el ejecutor de
 * automatizaciones (src/lib/jobs/run-automations.ts). Antes eran dos sistemas
 * separados que reimplementaban la misma lógica (crear tarea, cambiar etapa...)
 * cada uno por su cuenta.
 */
export const ACTION_REGISTRY: Record<string, ActionDefinition> = {
  [bookAppointmentTool.key]: bookAppointmentTool,
  [createNoteTool.key]: createNoteTool,
  [createTaskTool.key]: createTaskTool,
  [getAvailabilityTool.key]: getAvailabilityTool,
  [updateUserDetailsTool.key]: updateUserDetailsTool,
  [removeTagTool.key]: removeTagTool,
  [searchInventoryTool.key]: searchInventoryTool,
  [sendPropertyPhotosTool.key]: sendPropertyPhotosTool,
  [sendPropertyLocationTool.key]: sendPropertyLocationTool,
  [sendMessageAction.key]: sendMessageAction,
  [addTagAction.key]: addTagAction,
  [changeStageAction.key]: changeStageAction,
  [assignUserAction.key]: assignUserAction,
  [notifyTeamAction.key]: notifyTeamAction,
  [aiGenerateMessageAction.key]: aiGenerateMessageAction,
  [aiAgentStepAction.key]: aiAgentStepAction,
};

export function buildAnthropicTools(toolKeys: string[]): Anthropic.Tool[] {
  return toolKeys
    .map((k) => ACTION_REGISTRY[k]?.anthropicSchema)
    .filter((t): t is Anthropic.Tool => Boolean(t));
}

export async function executeTool(key: string, input: unknown, ctx: ActionContext): Promise<string> {
  const tool = ACTION_REGISTRY[key];
  if (!tool) return `La herramienta "${key}" no está implementada todavía.`;
  try {
    return await tool.execute(input, ctx);
  } catch (e) {
    return `Error ejecutando "${key}": ${e instanceof Error ? e.message : "error desconocido"}`;
  }
}

/** Traduce los AutomationAction.type (SCREAMING_SNAKE_CASE, guardados en la BD) a la key del registro. */
export const AUTOMATION_ACTION_TO_KEY: Record<string, string> = {
  SEND_MESSAGE: "send_message",
  CREATE_TASK: "create_task",
  ADD_TAG: "add_tag",
  CHANGE_STAGE: "change_stage",
  ASSIGN_USER: "assign_user",
  NOTIFY_TEAM: "notify_team",
  AI_GENERATE_MESSAGE: "ai_generate_message",
  AI_AGENT_STEP: "ai_agent_step",
};
