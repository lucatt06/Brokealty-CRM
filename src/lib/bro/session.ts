import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

/**
 * Sesión de Bro por (contacto, usuario): memoria persistente + compactación automática.
 *
 * Al llegar al 50 % de la ventana de contexto, los turnos viejos se resumen en una fila `summary` y dejan de enviarse
 * completos (los 2 últimos intercambios se conservan tal cual). Los turnos originales NO se borran: se siguen viendo
 * en pantalla; solo cambia lo que se le manda al modelo.
 */

export const CONTEXT_TOKENS = Number(process.env.BRO_CONTEXT_TOKENS) || 200_000;
export const COMPACT_RATIO = 0.5;
export const compactThreshold = () => Math.floor(CONTEXT_TOKENS * COMPACT_RATIO);
const CHARS_PER_TOKEN = 3.2; // conservador para español
const TOOLS_OVERHEAD_TOKENS = 3_000;
const KEEP_ROWS = 4; // 2 intercambios (usuario + Bro) sin compactar
export const estimateTokens = (chars: number) => Math.ceil(chars / CHARS_PER_TOKEN);
export const TOOLS_OVERHEAD = TOOLS_OVERHEAD_TOKENS;

// ── Cola por sesión ──────────────────────────────────────────────────────────────────────────────
// Cada sesión procesa de a una cosa: si llega un mensaje mientras se compacta (o mientras Bro responde otro),
// espera en la cola y sigue después. (Proceso único en Railway; con varias réplicas habría que usar un lock en BD.)
// En globalThis para que sea una sola cola aunque Next empaquete este módulo en más de un bundle.
const g = globalThis as unknown as { __broChains?: Map<string, Promise<unknown>>; __broCompacting?: Set<string> };
const chains = (g.__broChains ??= new Map<string, Promise<unknown>>());
const compacting = (g.__broCompacting ??= new Set<string>());

export const sessionKey = (workspaceId: string, leadId: string, userId: string) => `${workspaceId}:${leadId}:${userId}`;
export const isCompacting = (key: string) => compacting.has(key);

export function runInSession<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  chains.set(key, next);
  next.finally(() => { if (chains.get(key) === next) chains.delete(key); }).catch(() => undefined);
  return next;
}

// ── Carga de la memoria ──────────────────────────────────────────────────────────────────────────
type Row = { id: string; role: string; content: string; drafts: unknown; actions: unknown; createdAt: Date };
export type SessionState = { summary: { content: string; coversUntil: Date | null } | null; rows: Row[] };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function loadSession(workspaceId: string, leadId: string, userId: string): Promise<SessionState> {
  const summary = await prisma.broMessage.findFirst({
    where: { workspaceId, leadId, userId, role: "summary" }, orderBy: { createdAt: "desc" },
    select: { content: true, coversUntil: true },
  });
  const rows = await prisma.broMessage.findMany({
    where: { workspaceId, leadId, userId, role: { in: ["user", "assistant"] }, ...(summary?.coversUntil ? { createdAt: { gt: summary.coversUntil } } : {}) },
    orderBy: { createdAt: "asc" }, take: 3000,
    select: { id: true, role: true, content: true, drafts: true, actions: true, createdAt: true },
  });
  return { summary, rows };
}

/** Lo que Bro hizo/propuso también forma parte de su memoria, no solo lo que dijo. */
function rowContent(r: Row) {
  const extra = [
    ...strings(r.drafts).map((d) => `[Borrador que propuse: ${d}]`),
    ...strings(r.actions).map((a) => `[Acción que ejecuté: ${a}]`),
  ].join("\n");
  return extra ? `${r.content}\n${extra}` : r.content;
}

/** Mensajes para el modelo: resumen (si hay) + turnos posteriores. `maxChars` recorta lo más viejo (solo como plan B si compactar falla). */
export function toModelMessages(state: SessionState, maxChars?: number): Anthropic.Messages.MessageParam[] {
  let rows = state.rows;
  if (maxChars !== undefined) {
    let used = state.summary?.content.length ?? 0;
    const kept: Row[] = [];
    for (const r of [...rows].reverse()) {
      const len = rowContent(r).length;
      if (used + len > maxChars && kept.length >= 2) break;
      kept.push(r); used += len;
    }
    rows = kept.reverse();
  }
  const out: Anthropic.Messages.MessageParam[] = [];
  if (state.summary) {
    out.push({ role: "user", content: `[Resumen de nuestra conversación anterior sobre este contacto]\n${state.summary.content}` });
    out.push({ role: "assistant", content: "Entendido. Tengo ese resumen presente y continúo desde ahí." });
  }
  const turns = rows.map((r) => ({ role: (r.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: rowContent(r) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  return [...out, ...turns];
}

export const messagesChars = (msgs: Anthropic.Messages.MessageParam[]) =>
  msgs.reduce((n, m) => n + (typeof m.content === "string" ? m.content.length : JSON.stringify(m.content).length), 0);

// ── Compactación ─────────────────────────────────────────────────────────────────────────────────
const COMPACT_SYSTEM = `Eres el módulo de COMPACTACIÓN de Bro, el asistente de IA de un CRM inmobiliario. Recibes la charla entre un usuario del equipo y Bro sobre UN contacto, y la reduces a un resumen que Bro usará como memoria en lugar de los turnos originales.

El resumen debe conservar, sin perder nada importante:
- Lo que el usuario pidió, preguntó o decidió, y lo que quedó pendiente o sin responder.
- Hechos del cliente que salieron en la charla (preferencias, presupuesto, objeciones, fechas, nombres, propiedades mencionadas).
- Borradores de mensaje que Bro propuso (texto o idea) y acciones que ejecutó (tareas, notas, etapas, citas…), con fechas si las hubo.
- Preferencias del usuario sobre cómo quiere que Bro trabaje.

Reglas: español, en viñetas cortas agrupadas por tema, sin saludos ni relleno, máximo ~700 palabras. No inventes nada. Si recibes un resumen previo, intégralo con la charla nueva en un solo resumen actualizado.`;

/**
 * Resume los turnos viejos y guarda el resumen. Devuelve true si compactó. No lanza: si falla, devuelve false
 * y la charla sigue con el plan B (recorte) en vez de quedarse bloqueada.
 */
export async function compactSession(params: { client: Anthropic; model: string; workspaceId: string; leadId: string; userId: string }): Promise<boolean> {
  const { client, model, workspaceId, leadId, userId } = params;
  const key = sessionKey(workspaceId, leadId, userId);
  compacting.add(key);
  try {
    const state = await loadSession(workspaceId, leadId, userId);
    if (state.rows.length <= KEEP_ROWS) return false;
    let keep = state.rows.slice(-KEEP_ROWS);
    if (keep[0].role !== "user") keep = state.rows.slice(-(KEEP_ROWS + 1));
    const old = state.rows.slice(0, state.rows.length - keep.length);
    if (old.length === 0) return false;

    const transcript = old.map((r) => `${r.role === "user" ? "USUARIO" : "BRO"}: ${rowContent(r)}`).join("\n\n");
    const input = `${state.summary ? `RESUMEN PREVIO:\n${state.summary.content}\n\n` : ""}CHARLA A COMPACTAR:\n${transcript}`;
    const res = await client.messages.create({ model, max_tokens: 2000, system: COMPACT_SYSTEM, messages: [{ role: "user", content: input }] });
    const text = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text) return false;

    const last = old[old.length - 1].createdAt;
    await prisma.broMessage.create({
      data: { workspaceId, leadId, userId, role: "summary", content: text, coversUntil: last, createdAt: new Date(last.getTime() + 1) },
    });
    return true;
  } catch (e) {
    console.error("[bro] no se pudo compactar la conversación:", e instanceof Error ? e.message : e);
    return false;
  } finally {
    compacting.delete(key);
  }
}
