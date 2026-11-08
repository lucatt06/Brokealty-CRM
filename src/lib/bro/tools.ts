import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { cleanDisplayName } from "@/lib/leads/contact-name";
import { ACTION_REGISTRY } from "@/lib/actions/registry";

/**
 * Herramientas de Bro. Todas operan SOLO sobre el contacto abierto (ctx.leadId, ya verificado) y el workspace
 * de la sesión. Deliberadamente NO incluye enviar mensajes/ubicaciones al cliente: Bro redacta borradores
 * (draft_reply) y la persona decide enviarlos. Así un texto malicioso del cliente no puede hacer que Bro le escriba a nadie.
 */
export const BRO_ACTION_KEYS = [
  "search_inventory",
  "create_task",
  "create_note",
  "update_user_details",
  "change_stage",
  "add_tag",
  "remove_tag",
  "get_availability",
  "book_appointment",
] as const;

const DRAFT_REPLY: Anthropic.Tool = {
  name: "draft_reply",
  description:
    "Prepara un borrador de mensaje para enviarle al cliente. NO lo envía: la persona lo revisa y decide. Úsala siempre que te pidan escribirle, responderle o hacerle seguimiento.",
  input_schema: {
    type: "object",
    properties: { text: { type: "string", description: "Texto del mensaje, listo para enviar, en el tono del equipo" } },
    required: ["text"],
  },
};

const UPDATE_NAME: Anthropic.Tool = {
  name: "update_contact_name",
  description: "Corrige el nombre del contacto (nombre y apellido).",
  input_schema: {
    type: "object",
    properties: { firstName: { type: "string" }, lastName: { type: "string" } },
    required: ["firstName"],
  },
};

export function broTools(): Anthropic.Tool[] {
  const fromRegistry = BRO_ACTION_KEYS.map((k) => ACTION_REGISTRY[k]?.anthropicSchema).filter((t): t is Anthropic.Tool => Boolean(t));
  return [...fromRegistry, DRAFT_REPLY, UPDATE_NAME];
}

export type BroToolResult = { content: string; draft?: string; action?: string };

export async function runBroTool(
  name: string,
  input: unknown,
  ctx: { workspaceId: string; leadId: string; conversationId: string | null }
): Promise<BroToolResult> {
  if (name === "draft_reply") {
    const text = String((input as { text?: unknown })?.text ?? "").trim().slice(0, 4000);
    if (!text) return { content: "El borrador estaba vacío." };
    return { content: "Borrador listo. La persona lo verá y decidirá si lo envía. No digas que ya fue enviado.", draft: text };
  }
  if (name === "update_contact_name") {
    const i = input as { firstName?: unknown; lastName?: unknown };
    const first = cleanDisplayName(typeof i.firstName === "string" ? i.firstName : "");
    const last = cleanDisplayName(typeof i.lastName === "string" ? i.lastName : "") || null;
    if (!first) return { content: "El nombre no puede estar vacío." };
    await prisma.lead.updateMany({ where: { id: ctx.leadId, workspaceId: ctx.workspaceId }, data: { firstName: first, lastName: last } });
    return { content: `Nombre actualizado a "${[first, last].filter(Boolean).join(" ")}".`, action: `Nombre corregido: ${[first, last].filter(Boolean).join(" ")}` };
  }
  if (!(BRO_ACTION_KEYS as readonly string[]).includes(name)) return { content: `La herramienta "${name}" no está disponible.` };
  const tool = ACTION_REGISTRY[name];
  if (!tool) return { content: `La herramienta "${name}" no está disponible.` };
  try {
    const result = await tool.execute(input, { workspaceId: ctx.workspaceId, leadId: ctx.leadId, conversationId: ctx.conversationId, agentId: null });
    // search_inventory y get_availability solo consultan: no se listan como "acción realizada".
    const readOnly = name === "search_inventory" || name === "get_availability";
    return { content: result, action: readOnly ? undefined : result };
  } catch (e) {
    return { content: `Error ejecutando "${name}": ${e instanceof Error ? e.message : "error desconocido"}` };
  }
}
