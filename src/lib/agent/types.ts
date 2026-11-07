// El contrato de tool/acción vive en src/lib/actions/types.ts, compartido entre
// el loop del agente conversacional y el ejecutor de automatizaciones (Fase D).
export type { ActionContext as ToolContext, ActionDefinition as AgentToolDefinition } from "@/lib/actions/types";
