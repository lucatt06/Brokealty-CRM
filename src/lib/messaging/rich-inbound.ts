import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Formatos ricos que llegan del cliente por WhatsApp (ubicación, encuesta, reacción, mensaje borrado). */

export type RichInbound = { kind: "location" | "poll"; content: string; meta: Prisma.InputJsonValue };

type RawLocation = { degreesLatitude?: number; degreesLongitude?: number; name?: string; address?: string };
type RawPoll = { name?: string; options?: { optionName?: string }[] };

export function locationInbound(loc: { latitude?: number; longitude?: number; name?: string; address?: string }): RichInbound | null {
  const { latitude, longitude } = loc;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const title = loc.name?.trim() || "Ubicación compartida";
  const lines = [`📍 ${title}`, loc.address?.trim(), `https://www.google.com/maps?q=${latitude},${longitude}`].filter(Boolean);
  return { kind: "location", content: lines.join("\n"), meta: { latitude, longitude, name: title, address: loc.address ?? "" } };
}

export function evolutionLocation(raw: RawLocation | undefined) {
  return raw ? locationInbound({ latitude: raw.degreesLatitude, longitude: raw.degreesLongitude, name: raw.name, address: raw.address }) : null;
}

export function pollInbound(raw: RawPoll | undefined): RichInbound | null {
  const question = raw?.name?.trim();
  const options = (raw?.options ?? []).map((o) => o.optionName?.trim()).filter((o): o is string => !!o);
  if (!question) return null;
  return { kind: "poll", content: `📊 ${question}\n${options.map((o) => `• ${o}`).join("\n")}`, meta: { question, options } };
}

/** La reacción del cliente se guarda en el mensaje reaccionado; "" la quita. */
export async function applyInboundReaction(workspaceId: string, targetExternalId: string, emoji: string, fromMe: boolean) {
  const target = await prisma.message.findFirst({
    where: { externalId: targetExternalId, conversation: { workspaceId } },
    select: { id: true, reactions: true },
  });
  if (!target) return;
  const next = { ...((target.reactions ?? {}) as Record<string, string>) };
  const side = fromMe ? "ME" : "CONTACT";
  if (emoji) next[side] = emoji; else delete next[side];
  await prisma.message.update({
    where: { id: target.id },
    data: { reactions: Object.keys(next).length ? (next as Prisma.InputJsonValue) : Prisma.JsonNull },
  });
}

/** El cliente borró un mensaje "para todos": se conserva el registro pero sin su contenido. */
export async function applyInboundRevoke(workspaceId: string, targetExternalId: string) {
  await prisma.message.updateMany({
    where: { externalId: targetExternalId, conversation: { workspaceId }, deletedAt: null },
    data: { content: "🚫 Mensaje eliminado", mediaUrl: null, mediaType: null, meta: Prisma.JsonNull, deletedAt: new Date() },
  });
}
