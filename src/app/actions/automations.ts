"use server";

import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getWorkspaceAiKey } from "@/lib/integrations/ai-keys";

const TRIGGERS = [
  "LEAD_CREATED", "LEAD_STAGE_CHANGED", "MESSAGE_RECEIVED", "APPOINTMENT_CREATED",
  "APPOINTMENT_REMINDER", "PROPERTY_SOLD", "TASK_DUE", "INACTIVITY", "CUSTOM",
] as const;

const ACTION_TYPES = [
  "SEND_MESSAGE", "CREATE_TASK", "ADD_TAG", "CHANGE_STAGE", "ASSIGN_USER", "WAIT", "NOTIFY_TEAM",
  "AI_GENERATE_MESSAGE", "AI_AGENT_STEP",
] as const;

export type AutomationProposal = {
  name: string;
  description: string;
  trigger: (typeof TRIGGERS)[number];
  triggerConfig: Record<string, unknown>;
  actions: { type: (typeof ACTION_TYPES)[number]; config: Record<string, unknown> }[];
};

const PROPOSE_TOOL: Anthropic.Tool = {
  name: "propose_automation",
  description: "Propone una automatización estructurada a partir de la descripción en texto libre del usuario",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nombre corto y claro de la automatización" },
      description: { type: "string", description: "Explicación en una frase de qué hace" },
      trigger: { type: "string", enum: [...TRIGGERS] },
      triggerConfig: {
        type: "object",
        description: "Parámetros del trigger. Ej: para INACTIVITY usar { \"days\": 3 }. Para LEAD_STAGE_CHANGED usar { \"toStage\": \"nombre\" }. Vacío si no aplica.",
      },
      actions: {
        type: "array",
        description: "Lista ordenada de acciones a ejecutar cuando dispare el trigger",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: [...ACTION_TYPES] },
            config: {
              type: "object",
              description:
                "Ej para SEND_MESSAGE: { \"channel\": \"WHATSAPP_PERSONAL\", \"content\": \"texto del mensaje\" }. " +
                "Para CREATE_TASK: { \"title\": \"...\", \"priority\": \"MEDIA\" }. Para ADD_TAG: { \"tag\": \"nombre\" }. " +
                "Para CHANGE_STAGE: { \"stage\": \"nombre\" }. Para WAIT: { \"hours\": 24 }. " +
                "Para AI_GENERATE_MESSAGE: { \"instruction\": \"escribe un mensaje personalizado pidiendo...\" } — la IA redacta el texto en el momento usando el contexto del lead, y lo envía. " +
                "Para AI_AGENT_STEP: { \"instruction\": \"...\", \"allowedActionKeys\": [\"create_task\", \"add_tag\"] } — la IA decide y ejecuta acciones por su cuenta, limitada a las acciones listadas en allowedActionKeys (usa las mismas keys en snake_case: create_task, add_tag, change_stage, assign_user, notify_team, remove_tag, create_note). Úsala con moderación, SOLO cuando el usuario pida explícitamente que la IA decida y actúe autónomamente — para la mayoría de los casos usa las acciones normales o AI_GENERATE_MESSAGE.",
            },
          },
          required: ["type", "config"],
        },
      },
    },
    required: ["name", "description", "trigger", "triggerConfig", "actions"],
  },
};

export async function proposeAutomationFromText(workspaceId: string, text: string): Promise<
  { proposal: AutomationProposal; error?: undefined } | { proposal?: undefined; error: string }
> {
  const trimmed = text.trim();
  if (!trimmed) return { error: "Describe qué quieres automatizar." };

  const apiKey = (await getWorkspaceAiKey(workspaceId, "ANTHROPIC")) ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Configura una API key de Anthropic en Integraciones (o ANTHROPIC_API_KEY en .env.local)." };

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system:
        "Eres el constructor de automatizaciones de un CRM para inmobiliarias. " +
        "Convierte la descripción en texto libre del usuario en una automatización estructurada usando SIEMPRE la tool propose_automation. " +
        "Si el usuario no especifica un canal de mensaje, usa WHATSAPP_PERSONAL. Sé conservador: solo incluye acciones que el usuario pidió explícita o implícitamente.",
      tools: [PROPOSE_TOOL],
      tool_choice: { type: "tool", name: "propose_automation" },
      messages: [{ role: "user", content: trimmed }],
    });

    const toolUse = response.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return { error: "No se pudo interpretar la automatización, intenta describirla de otra forma." };

    return { proposal: toolUse.input as AutomationProposal };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { error: `No se pudo contactar al modelo: ${msg}` };
  }
}

export async function createAutomationFromProposal(workspaceId: string, proposal: AutomationProposal) {
  await prisma.automation.create({
    data: {
      workspaceId,
      name: proposal.name,
      description: proposal.description,
      isActive: true,
      trigger: proposal.trigger,
      triggerConfig: proposal.triggerConfig as Prisma.InputJsonValue,
      actions: {
        create: proposal.actions.map((a, i) => ({ order: i, type: a.type, config: a.config as Prisma.InputJsonValue })),
      },
    },
  });
  revalidatePath("/automatizaciones");
}

export async function listAutomations(workspaceId: string) {
  const rows = await prisma.automation.findMany({
    where: { workspaceId },
    include: { actions: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() }));
}

export async function toggleAutomationActive(id: string, isActive: boolean) {
  await prisma.automation.update({ where: { id }, data: { isActive } });
  revalidatePath("/automatizaciones");
}

export async function deleteAutomation(id: string) {
  await prisma.automation.delete({ where: { id } });
  revalidatePath("/automatizaciones");
}
