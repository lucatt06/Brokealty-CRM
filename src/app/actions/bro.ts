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

export type BroTurn = { role: "user" | "assistant"; content: string };
export type BroResult =
  | { ok: true; reply: string; drafts: string[]; actions: string[] }
  | { ok: false; error: string };

const MAX_TURNS = 20;
const MAX_CHARS = 4000;

/** Habla con Bro sobre un contacto. El workspace sale de la sesión; el lead se verifica antes de leer nada. */
export async function askBro(leadId: string, conversationId: string | null, history: BroTurn[], message: string): Promise<BroResult> {
  const ctx = await requireCtx();
  if (typeof leadId !== "string" || typeof message !== "string") return { ok: false, error: "Solicitud no válida." };
  await assertOwns("lead", leadId, ctx.workspace.id);
  if (conversationId) await assertOwns("conversation", conversationId, ctx.workspace.id);

  const text = message.trim().slice(0, MAX_CHARS);
  if (!text) return { ok: false, error: "Escribe algo para Bro." };
  if (!rateLimit(`bro:${ctx.user.id}`, 30, 60_000)) return { ok: false, error: "Vas muy rápido. Espera un momento." };

  const apiKey = (await getWorkspaceAiKey(ctx.workspace.id, "ANTHROPIC")) ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "Bro todavía no tiene su llave de IA. Agrega la API key de Anthropic en Integraciones." };

  // El historial viene del navegador: se sanea (solo roles válidos, texto, acotado).
  const past: Anthropic.Messages.MessageParam[] = (Array.isArray(history) ? history : [])
    .filter((t): t is BroTurn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim().length > 0)
    .slice(-MAX_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_CHARS) }));
  while (past.length && past[0].role !== "user") past.shift();
  const messages: Anthropic.Messages.MessageParam[] = [...past, { role: "user", content: text }];

  const leadContext = await buildLeadContext(ctx.workspace.id, leadId, conversationId);
  const system = buildBroPrompt({ workspaceName: ctx.workspace.name, userName: ctx.user.name ?? "el equipo", leadContext });

  const drafts: string[] = [];
  const actions: string[] = [];
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
    if (actions.length) {
      await prisma.activity.create({
        data: { workspaceId: ctx.workspace.id, leadId, type: "NOTE_ADDED", description: `Bro (a pedido de ${ctx.user.name ?? "un usuario"}): ${actions.join(" · ")}`.slice(0, 1000) },
      }).catch(() => {});
    }
    return { ok: true, reply: result.finalText || (drafts.length ? "Te dejé un borrador abajo." : "Listo."), drafts, actions };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bro no pudo responder." };
  }
}
