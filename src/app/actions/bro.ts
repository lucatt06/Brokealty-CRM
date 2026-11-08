"use server";

import Anthropic from "@anthropic-ai/sdk";
import { assertOwns, requireCtx } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/prisma";
import { BRO_MODEL } from "@/lib/bro/model";
import { getWorkspaceAiKey } from "@/lib/integrations/ai-keys";
import { runToolCallingLoop } from "@/lib/agent/tool-loop";
import { buildLeadContext } from "@/lib/bro/context";
import { buildBroPrompt } from "@/lib/bro/prompt";
import { broTools, runBroTool } from "@/lib/bro/tools";
import {
  TOOLS_OVERHEAD, compactSession, compactThreshold, estimateTokens, loadSession, messagesChars,
  runInSession, sessionKey, toModelMessages,
} from "@/lib/bro/session";

export type BroEntry = { id: string; role: "user" | "assistant" | "summary"; content: string; drafts: string[]; actions: string[] };
export type BroResult =
  | { ok: true; entries: BroEntry[] }
  | { ok: false; error: string };

const MAX_INPUT_CHARS = 4000;
const SCREEN_TURNS = 150; // lo que se muestra al abrir la pestaña

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const toEntry = (m: { id: string; role: string; content: string; drafts: unknown; actions: unknown }): BroEntry => ({
  id: m.id, role: m.role === "assistant" ? "assistant" : m.role === "summary" ? "summary" : "user", content: m.content, drafts: strings(m.drafts), actions: strings(m.actions),
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

  const key = sessionKey(ctx.workspace.id, leadId, ctx.user.id);
  const workspaceId = ctx.workspace.id;
  const userId = ctx.user.id;
  const userName = ctx.user.name ?? "el equipo";
  const workspaceName = ctx.workspace.name;
  const model = BRO_MODEL;
  const client = new Anthropic({ apiKey });

  // Todo pasa por la cola de la sesión: si Bro está respondiendo o compactando, este mensaje espera su turno y sigue después.
  return runInSession(key, async (): Promise<BroResult> => {
    const leadContext = await buildLeadContext(workspaceId, leadId);
    const system = buildBroPrompt({ workspaceName, userName, leadContext });
    const threshold = compactThreshold();
    const fixedTokens = estimateTokens(system.length) + TOOLS_OVERHEAD + estimateTokens(text.length);

    let state = await loadSession(workspaceId, leadId, userId);
    let memory = toModelMessages(state);
    // Si con este mensaje se pasa del 50 %: se compacta ANTES de responder (el mensaje del usuario queda en cola) y luego se sigue.
    if (fixedTokens + estimateTokens(messagesChars(memory)) >= threshold) {
      const done = await compactSession({ client, model, workspaceId, leadId, userId });
      state = await loadSession(workspaceId, leadId, userId);
      // Plan B si no se pudo compactar: recortar lo más viejo para no pasarse de la ventana.
      memory = done ? toModelMessages(state) : toModelMessages(state, Math.max(0, (threshold - fixedTokens) * 3.2));
    }
    const messages: Anthropic.Messages.MessageParam[] = [...memory, { role: "user", content: text }];

    const drafts: string[] = [];
    const actions: string[] = [];
    let reply: string;
    let lastInputTokens = 0;
    try {
      const result = await runToolCallingLoop({
        client,
        model,
        // cache_control: el contexto del cliente + memoria se reutilizan entre turnos seguidos (mucho más barato).
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: broTools(),
        messages,
        maxIterations: 6,
        executeToolCall: async (block) => {
          const r = await runBroTool(block.name, block.input, { workspaceId, leadId, conversationId });
          if (r.draft) drafts.push(r.draft);
          if (r.action) actions.push(r.action);
          return { content: r.content };
        },
      });
      reply = result.finalText || (drafts.length ? "Te dejé un borrador abajo." : "Listo.");
      lastInputTokens = result.lastInputTokens;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Bro no pudo responder." };
    }

    // Se guarda el intercambio completo solo si Bro respondió (así la memoria nunca queda con un turno huérfano).
    const t0 = Date.now();
    await prisma.broMessage.createMany({
      data: [
        { workspaceId, leadId, userId, role: "user", content: text, createdAt: new Date(t0) },
        { workspaceId, leadId, userId, role: "assistant", content: reply, drafts, actions, createdAt: new Date(t0 + 1) },
      ],
    });
    if (actions.length) {
      await prisma.activity.create({
        data: { workspaceId, leadId, type: "NOTE_ADDED", description: `Bro (a pedido de ${userName}): ${actions.join(" · ")}`.slice(0, 1000) },
      }).catch(() => {});
    }

    // Con el tamaño REAL del contexto en esta respuesta: si llegó al 50 %, se compacta ya mismo (en segundo plano).
    // Se encola detrás de este turno; si el usuario escribe mientras tanto, su mensaje espera a que termine.
    if (lastInputTokens >= threshold) {
      void runInSession(key, () => compactSession({ client, model, workspaceId, leadId, userId }));
    }
    return getBroHistory(leadId);
  });
}
