type PromptAgent = {
  personality: string | null;
  goal: string | null;
  additionalInfo: string | null;
  businessName: string | null;
  actions: string[];
  actionsConfig: Record<string, unknown>;
};

type KnowledgeSnippet = { title: string; content: string | null };

export function buildSystemPrompt(agent: PromptAgent, workspaceName: string, knowledge: KnowledgeSnippet[]) {
  const businessName = agent.businessName || workspaceName;
  const substitute = (text: string) => text.replaceAll("{{ai.business_name}}", businessName);

  const parts: string[] = [];
  if (agent.personality) parts.push(substitute(agent.personality));
  if (agent.goal) parts.push(`Objetivo: ${substitute(agent.goal)}`);
  if (agent.additionalInfo) parts.push(substitute(agent.additionalInfo));

  const kbText = knowledge
    .filter((k) => k.content)
    .map((k) => `### ${k.title}\n${k.content}`)
    .join("\n\n");
  if (kbText) parts.push(`Base de conocimiento:\n${kbText}`);

  const actionNotes = buildActionGuidance(agent.actions, agent.actionsConfig);
  if (actionNotes) parts.push(actionNotes);

  return parts.join("\n\n") || `Eres un asistente virtual para ${businessName}.`;
}

function buildActionGuidance(actions: string[], config: Record<string, unknown>): string {
  const notes: string[] = [];

  if (actions.includes("CONTACT_INFO")) {
    const cfg = config.CONTACT_INFO as { fields?: { fieldKey: string; instruction: string }[] } | undefined;
    const fields = (cfg?.fields ?? []).filter((f) => f.fieldKey && f.instruction);
    if (fields.length) {
      const lines = fields.map((f) => `- ${f.instruction} → usa la herramienta update_user_details con field="${f.fieldKey}"`);
      notes.push(`Actualización de datos del contacto:\n${lines.join("\n")}`);
    }
  }

  if (actions.includes("APPOINTMENT_BOOKING")) {
    const cfg = config.APPOINTMENT_BOOKING as { minNoticeHours?: number; confirmationMessage?: string } | undefined;
    const lines: string[] = [];
    if (cfg?.minNoticeHours) lines.push(`- No ofrezcas horarios con menos de ${cfg.minNoticeHours} horas de anticipación.`);
    if (cfg?.confirmationMessage) lines.push(`- Al confirmar una cita, básate en este mensaje: "${cfg.confirmationMessage}"`);
    if (lines.length) notes.push(`Agendar citas:\n${lines.join("\n")}`);
  }

  return notes.join("\n\n");
}
