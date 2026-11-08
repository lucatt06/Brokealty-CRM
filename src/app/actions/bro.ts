"use server";

import Anthropic from "@anthropic-ai/sdk";
import { assertOwns, requireCtx } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/prisma";
import { AI_MODELS } from "@/lib/ai-models";
import { getWorkspaceAiKey } from "@/lib/integrations/ai-keys";
import { runToolCallingLoop } from "@/lib/agent/tool-loop";
import { buildLeadContext } from "@/lib/bro/context";
import { buildBroPrompt } from "@/lib/bro/prompt";
import { broTools, runBroTool } from "@/lib/bro/tools";

export type BroEntry = { id: string; role: "user" | "assistant"; content: string; drafts: string[]; actions: string[] };
export type BroResult =
  | { ok: true; entries: BroEntry[] }
  | { ok: false; error: string };

const MAX_INPUT_CHARS = 4000;
const MEMORY_TURNS = 80; // turnos de la sesión que Bro recuerda en cada respuesta…
const MEMORY_CHARS = 40_000; // …hasta este presupuesto (lo más reciente primero)
const SCREEN_TURNS = 150; // lo que se muestra al abrir la pestaña

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const toEntry = (m: { id: string; role: string; content: string; drafts: unknown; actions: unknown }): BroEntry => ({
  id: m.id, role: m.role === "assistant" ? "assistant" : "user", content: m.content, drafts: strings(m.drafts), actions: strings(m.actions),
});

/** Sesión guardada de este usuario con Bro sobre este contacto (memoria propia de cada cliente). */
export async function getBroHistory(leadId: string): Promise<BroResult> {
  const ctx = await requireCtx();
  if (typeof leadId !== "string") return { ok: false, error: "Solicitud no válida." };
  await assertOwns("lead", leadId, ctx.workspace.id);
  const rows = await prisma.broMessage.findMany({
    where: { workspaceId: ctx.workspace.id, leadId, userId: ctx.user.id },
    orderBy: { createdAt: "desc" }, take: SCREEN_TURNS,
  });
  return { ok: true, entries: rows.reverse().map(toEntry) };
}

/** Memoria que se le da al modelo: lo más reciente que quepa, empezando siempre por un turno del usuario. */
async function loadMemory(workspaceId: string, leadId: string, userId: string): Promise<Anthropic.Messages.MessageParam[]> {
  const rows = await prisma.broMessage.findMany({
    where: { workspaceId, leadId, userId }, orderBy: { createdAt: "desc" }, take: MEMORY_TURNS,
    select: { role: true, content: true, drafts: true, actions: true },
  });
  const kept: { role: "user" | "assistant"; content: string }[] = [];
  let used = 0;
  for (const r of rows) {
    // Lo que Bro hizo/propuso también forma parte de su memoria, no solo lo que dijo.
    const extra = [
      ...strings(r.drafts).map((d) => `[Borrador que propuse: ${d}]`),
      ...strings(r.actions).map((a) => `[Acción que ejecuté: ${a}]`),
    ].join("\n");
    const content = extra ? `${r.content}\n${extra}` : r.content;
    if (used + content.length > MEMORY_CHARS) break;
    kept.push({ role: r.role === "assistant" ? "assistant" : "user", content });
    used += content.length;
  }
  kept.reverse();
  while (kept.length && kept[0].role !== "user") kept.shift();
  return kept;
}

/**
 * Habla con Bro sobre un contacto. El workspace sale de la sesión, el lead se verifica antes de leer nada, y la memoria
 * de la charla vive en la base de datos (no en el navegador, que no es de fiar).
 */
export async function askBro(leadId: string, conversationId: string | null, message: string): Promise<BroResult> {
  const ctx = await requireCtx();
  if (typeof leadId !== "string" || typeof message !== "string") return { ok: false, error: "Solicitud no válida." };
  await assertOwns("lead", leadId, ctx.workspace.id);
  if (conversationId) await assertOwns("conversation", conversationId, ctx.workspace.id);

  const text = message.trim().slice(0, MAX_INPUT_CHARS);
  if (!text) return { ok: false, error: "Escribe algo para Bro." };
  if (!rateLimit(`bro:${ctx.user.id}`, 30, 60_000)) return { ok: false, error: "Vas muy rápido. Espera un momento." };

  const apiKey = (await getWorkspaceAiKey(ctx.workspace.id, "ANTHROPIC")) ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "Bro todavía no tiene su llave de IA. Agrega la API key de Anthropic en Integraciones." };

  const memory = await loadMemory(ctx.workspace.id, leadId, ctx.user.id);
  const messages: Anthropic.Messages.MessageParam[] = [...memory, { role: "user", content: text }];

  const leadContext = await buildLeadContext(ctx.workspace.id, leadId);
  const system = buildBroPrompt({ workspaceName: ctx.workspace.name, userName: ctx.user.name ?? "el equipo", leadContext });

  const drafts: string[] = [];
  const actions: string[] = [];
  let reply: string;
  try {
    const result = await runToolCallingLoop({
      client: new Anthropic({ apiKey }),
      model: "claude-sonnet-5" in AI_MODELS ? "claude-sonnet-5" : Object.keys(AI_MODELS)[0],
      system,
      tools: broTools(),
      messages,
      maxIterations: 6,
      executeToolCall: async (block) => {
        const r = await runBroTool(block.name, block.input, { workspaceId: ctx.workspace.id, leadId, conversationId });
        if (r.draft) drafts.push(r.draft);
        if (r.action) actions.push(r.action);
        return { content: r.content };
      },
    });
    reply = result.finalText || (drafts.length ? "Te dejé un borrador abajo." : "Listo.");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bro no pudo responder." };
  }

  // Se guarda el intercambio completo solo si Bro respondió (así la memoria nunca queda con un turno huérfano).
  const t0 = Date.now();
  await prisma.broMessage.createMany({
    data: [
      { workspaceId: ctx.workspace.id, leadId, userId: ctx.user.id, role: "user", content: text, createdAt: new Date(t0) },
      { workspaceId: ctx.workspace.id, leadId, userId: ctx.user.id, role: "assistant", content: reply, drafts, actions, createdAt: new Date(t0 + 1) },
    ],
  });
  if (actions.length) {
    await prisma.activity.create({
      data: { workspaceId: ctx.workspace.id, leadId, type: "NOTE_ADDED", description: `Bro (a pedido de ${ctx.user.name ?? "un usuario"}): ${actions.join(" · ")}`.slice(0, 1000) },
    }).catch(() => {});
  }
  return getBroHistory(leadId);
}
