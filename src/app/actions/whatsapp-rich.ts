"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertOwns, requireCtx } from "@/lib/auth/guards";
import {
  UnsupportedChannelError, deleteOutboundMessage, editOutboundMessage,
  sendOutboundLocation, sendOutboundPoll, sendOutboundReaction,
} from "@/lib/messaging/send-outbound";
import { Prisma } from "@prisma/client";

/**
 * Acciones ricas de WhatsApp desde la bandeja de Conversaciones. Devuelven `{ ok, error }` en
 * vez de lanzar: en producción Next oculta el texto de los errores lanzados por una Server
 * Action, y aquí el usuario necesita leer por qué no se pudo (canal sin soporte, fuera de plazo…).
 */
type Result = { ok: true } | { ok: false; error: string };

const EDIT_WINDOW_MS = 15 * 60_000; // límite de WhatsApp para editar
const DELETE_WINDOW_MS = 2 * 24 * 60 * 60_000; // límite práctico de "eliminar para todos"
const WA_CHANNELS = ["WHATSAPP", "WHATSAPP_PERSONAL"] as const;
type WaChannel = (typeof WA_CHANNELS)[number];

const fail = (error: string): Result => ({ ok: false, error });

function friendly(e: unknown): Result {
  if (e instanceof UnsupportedChannelError) return fail(e.message);
  console.error("[whatsapp-rich]", e);
  return fail("WhatsApp no pudo completar la acción. Verifica que el número siga conectado e inténtalo de nuevo.");
}

async function loadConversation(conversationId: string) {
  const ctx = await requireCtx();
  await assertOwns("conversation", conversationId, ctx.workspace.id);
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { id: true, workspaceId: true, leadId: true, channel: true, externalId: true, isAiHandled: true },
  });
  const channel = conversation.channel as string;
  if (!(WA_CHANNELS as readonly string[]).includes(channel) || !conversation.externalId) return { ctx, conversation, wa: null };
  return { ctx, conversation, wa: { channel: channel as WaChannel, remoteId: conversation.externalId } };
}

async function loadMessage(messageId: string) {
  const ctx = await requireCtx();
  const message = await prisma.message.findFirst({
    where: { id: messageId, conversation: { workspaceId: ctx.workspace.id } },
    include: { conversation: { select: { id: true, workspaceId: true, channel: true, externalId: true } } },
  });
  if (!message) return { ctx, message: null, wa: null };
  const channel = message.conversation.channel as string;
  const ok = (WA_CHANNELS as readonly string[]).includes(channel) && !!message.conversation.externalId;
  return { ctx, message, wa: ok ? { channel: channel as WaChannel, remoteId: message.conversation.externalId as string } : null };
}

/** Un mensaje manual desde el CRM pausa al bot si el agente principal tiene "dormir al mensaje manual". */
async function pauseBotIfConfigured(conversation: { id: string; workspaceId: string; isAiHandled: boolean }) {
  if (!conversation.isAiHandled) return {};
  const agent = await prisma.aIAgent.findFirst({ where: { workspaceId: conversation.workspaceId, isPrimary: true }, select: { sleepOnManualMessage: true } });
  return agent?.sleepOnManualMessage ? { isAiHandled: false } : {};
}

// ── Ubicación de una propiedad ──────────────────────────────────────────
export async function sendPropertyLocation(conversationId: string, propertyId: string): Promise<Result> {
  const { ctx, conversation, wa } = await loadConversation(conversationId);
  if (!wa) return fail("Esta conversación no es de WhatsApp.");
  await assertOwns("property", propertyId, ctx.workspace.id);

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { title: true, sector: true, city: true, latitude: true, longitude: true },
  });
  if (property.latitude == null || property.longitude == null) {
    return fail("Esta propiedad no tiene coordenadas. Agrégalas en el Catálogo (campo Ubicación en el mapa).");
  }

  const location = {
    latitude: property.latitude,
    longitude: property.longitude,
    name: property.title,
    address: [property.sector, property.city].filter(Boolean).join(", ") || property.title,
  };
  try {
    const { externalId } = await sendOutboundLocation({ workspaceId: conversation.workspaceId, channel: wa.channel, externalId: wa.remoteId, location });
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId, direction: "OUTBOUND", channel: wa.channel, isRead: true, senderId: ctx.user.id, externalId,
          content: `📍 ${location.name}\n${location.address}\nhttps://www.google.com/maps?q=${location.latitude},${location.longitude}`,
          mediaType: "location", meta: location as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date(), ...(await pauseBotIfConfigured(conversation)) } }),
    ]);
    revalidatePath("/conversaciones");
    return { ok: true };
  } catch (e) {
    return friendly(e);
  }
}

// ── Encuesta ────────────────────────────────────────────────────────────
export async function sendPoll(conversationId: string, question: string, options: string[]): Promise<Result> {
  const { ctx, conversation, wa } = await loadConversation(conversationId);
  if (!wa) return fail("Esta conversación no es de WhatsApp.");

  const q = question.trim();
  const opts = Array.from(new Set(options.map((o) => o.trim()).filter(Boolean)));
  if (!q || q.length > 200) return fail("La pregunta es obligatoria (máx. 200 caracteres).");
  if (opts.length < 2 || opts.length > 10) return fail("La encuesta necesita entre 2 y 10 opciones distintas.");
  if (opts.some((o) => o.length > 100)) return fail("Cada opción admite hasta 100 caracteres.");

  try {
    const { externalId } = await sendOutboundPoll({ workspaceId: conversation.workspaceId, channel: wa.channel, externalId: wa.remoteId, question: q, options: opts });
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId, direction: "OUTBOUND", channel: wa.channel, isRead: true, senderId: ctx.user.id, externalId,
          content: `📊 ${q}\n${opts.map((o) => `• ${o}`).join("\n")}`,
          mediaType: "poll", meta: { question: q, options: opts } as Prisma.InputJsonValue,
        },
      }),
      prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date(), ...(await pauseBotIfConfigured(conversation)) } }),
    ]);
    revalidatePath("/conversaciones");
    return { ok: true };
  } catch (e) {
    return friendly(e);
  }
}

// ── Reacción ────────────────────────────────────────────────────────────
const SINGLE_EMOJI = /^\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u;

/** `emoji` vacío quita tu reacción. */
export async function reactToMessage(messageId: string, emoji: string): Promise<Result> {
  const { message, wa } = await loadMessage(messageId);
  if (!message) return fail("Mensaje no encontrado.");
  if (!wa) return fail("Solo se puede reaccionar en conversaciones de WhatsApp.");
  if (!message.externalId) return fail("Este mensaje no se puede reaccionar (aún no tiene confirmación de WhatsApp).");
  if (message.deletedAt) return fail("Ese mensaje fue eliminado.");
  if (emoji !== "" && !SINGLE_EMOJI.test(emoji)) return fail("Reacción no válida.");

  try {
    await sendOutboundReaction({
      workspaceId: message.conversation.workspaceId, channel: wa.channel, remoteId: wa.remoteId,
      targetExternalId: message.externalId, targetFromMe: message.direction === "OUTBOUND", emoji,
    });
    const current = (message.reactions ?? {}) as Record<string, string>;
    const next = { ...current };
    if (emoji) next.ME = emoji; else delete next.ME;
    await prisma.message.update({
      where: { id: message.id },
      data: { reactions: Object.keys(next).length ? (next as Prisma.InputJsonValue) : Prisma.JsonNull },
    });
    revalidatePath("/conversaciones");
    return { ok: true };
  } catch (e) {
    return friendly(e);
  }
}

// ── Editar ──────────────────────────────────────────────────────────────
export async function editMessageText(messageId: string, text: string): Promise<Result> {
  const { message, wa } = await loadMessage(messageId);
  if (!message) return fail("Mensaje no encontrado.");
  if (!wa) return fail("Solo se pueden editar mensajes de WhatsApp.");
  const clean = text.trim();
  if (!clean || clean.length > 4000) return fail("El mensaje no puede estar vacío (máx. 4000 caracteres).");
  if (message.direction !== "OUTBOUND" || message.mediaType || message.deletedAt || !message.externalId) return fail("Solo se puede editar un mensaje de texto enviado por ti.");
  if (Date.now() - message.sentAt.getTime() > EDIT_WINDOW_MS) return fail("WhatsApp solo permite editar durante los primeros 15 minutos.");

  try {
    await editOutboundMessage({ workspaceId: message.conversation.workspaceId, channel: wa.channel, remoteId: wa.remoteId, targetExternalId: message.externalId, text: clean });
    await prisma.message.update({ where: { id: message.id }, data: { content: clean, editedAt: new Date() } });
    revalidatePath("/conversaciones");
    return { ok: true };
  } catch (e) {
    return friendly(e);
  }
}

// ── Eliminar para todos ─────────────────────────────────────────────────
export async function deleteMessageForEveryone(messageId: string): Promise<Result> {
  const { message, wa } = await loadMessage(messageId);
  if (!message) return fail("Mensaje no encontrado.");
  if (message.direction !== "OUTBOUND") return fail("Solo puedes eliminar mensajes enviados por ti.");
  if (message.deletedAt) return { ok: true };

  try {
    // Sin externalId (nunca llegó a WhatsApp) o canal no WhatsApp: solo existe en el CRM.
    if (wa && message.externalId) {
      if (Date.now() - message.sentAt.getTime() > DELETE_WINDOW_MS) return fail("WhatsApp solo permite eliminar para todos durante los primeros 2 días.");
      await deleteOutboundMessage({ workspaceId: message.conversation.workspaceId, channel: wa.channel, remoteId: wa.remoteId, targetExternalId: message.externalId });
    }
    await prisma.message.update({
      where: { id: message.id },
      data: { content: "🚫 Mensaje eliminado", mediaUrl: null, mediaType: null, meta: Prisma.JsonNull, reactions: Prisma.JsonNull, deletedAt: new Date() },
    });
    revalidatePath("/conversaciones");
    return { ok: true };
  } catch (e) {
    return friendly(e);
  }
}
