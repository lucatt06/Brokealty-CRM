import type Anthropic from "@anthropic-ai/sdk";

/**
 * Contexto compartido por cualquier acción ejecutable — sea invocada por el
 * loop de tool-calling del agente conversacional o por el ejecutor de
 * automatizaciones. conversationId/agentId son null cuando la acción corre
 * fuera de una conversación (ej. una automatización disparada por INACTIVITY).
 */
export type ActionContext = {
  workspaceId: string;
  leadId: string | null;
  conversationId: string | null;
  agentId: string | null;
  actionsConfig?: Record<string, unknown>;
  automationId?: string;
};

export type ActionDefinition = {
  key: string;
  /** Ausente para acciones que solo usan las automatizaciones (nunca se le ofrecen al modelo como tool). */
  anthropicSchema?: Anthropic.Tool;
  execute: (input: unknown, ctx: ActionContext) => Promise<string>;
};
