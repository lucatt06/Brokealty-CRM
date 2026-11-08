import { prisma } from "@/lib/prisma";
import { sendWhatsAppReply, sendMediaMessage } from "@/lib/evolution/client";
import * as evo from "@/lib/evolution/client";
import * as cloud from "@/lib/whatsapp-cloud/graph-client";
import { sendWhatsAppCloudReply, sendImageMessage } from "@/lib/whatsapp-cloud/graph-client";
import { getWorkspaceWhatsAppCloudConfig } from "@/lib/integrations/whatsapp-cloud-config";

type EvolutionConfig = { instanceName?: string };

/**
 * Punto único de envío saliente de WhatsApp, sin importar si la conversación es
 * por Evolution (no oficial) o por la API oficial de Meta (Cloud API). Los
 * llamadores que no conocen su canal al momento de escribir el código (buffer de
 * respuesta del agente, follow-ups, mensajes manuales, automatizaciones) pasan
 * por aquí en vez de asumir un proveedor fijo.
 */
export async function sendOutboundWhatsApp(params: {
  workspaceId: string;
  channel: "WHATSAPP_PERSONAL" | "WHATSAPP";
  externalId: string; // remoteJid (Evolution) o wa_id del cliente (Cloud API)
  text: string;
  inboundMessageId?: string; // solo lo usa Evolution (marcar leído + simular "escribiendo")
}): Promise<{ externalId: string | null }> {
  const { workspaceId, channel, externalId, text, inboundMessageId } = params;

  if (channel === "WHATSAPP_PERSONAL") {
    const integration = await prisma.integration.findFirst({
      where: { workspaceId, type: "WHATSAPP_EVOLUTION", isActive: true },
    });
    const instanceName = (integration?.config as EvolutionConfig | undefined)?.instanceName;
    if (!instanceName) return { externalId: null };

    const sent = await sendWhatsAppReply({ instanceName, remoteJid: externalId, text, inboundMessageId }).catch((err) => {
      console.error("Fallo enviando por Evolution:", err);
      return null;
    });
    return { externalId: sent?.key?.id ?? null };
  }

  if (channel === "WHATSAPP") {
    const config = await getWorkspaceWhatsAppCloudConfig(workspaceId);
    if (!config) return { externalId: null };

    const sent = await sendWhatsAppCloudReply({
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
      to: externalId,
      text,
    }).catch((err) => {
      console.error("Fallo enviando por WhatsApp Cloud API:", err);
      return null;
    });
    return { externalId: sent?.messages?.[0]?.id ?? null };
  }

  return { externalId: null };
}

/** Igual que sendOutboundWhatsApp pero para una foto/imagen — usado por send_property_photos. */
export async function sendOutboundWhatsAppMedia(params: {
  workspaceId: string;
  channel: "WHATSAPP_PERSONAL" | "WHATSAPP";
  externalId: string;
  mediaUrl: string;
  caption?: string;
}): Promise<{ externalId: string | null }> {
  const { workspaceId, channel, externalId, mediaUrl, caption } = params;

  if (channel === "WHATSAPP_PERSONAL") {
    const integration = await prisma.integration.findFirst({
      where: { workspaceId, type: "WHATSAPP_EVOLUTION", isActive: true },
    });
    const instanceName = (integration?.config as EvolutionConfig | undefined)?.instanceName;
    if (!instanceName) return { externalId: null };

    const sent = await sendMediaMessage(instanceName, externalId, mediaUrl, "image", caption).catch((err) => {
      console.error("Fallo enviando foto por Evolution:", err);
      return null;
    });
    return { externalId: sent?.key?.id ?? null };
  }

  if (channel === "WHATSAPP") {
    const config = await getWorkspaceWhatsAppCloudConfig(workspaceId);
    if (!config) return { externalId: null };

    const sent = await sendImageMessage(config.phoneNumberId, config.accessToken, externalId, mediaUrl, caption).catch((err) => {
      console.error("Fallo enviando foto por WhatsApp Cloud API:", err);
      return null;
    });
    return { externalId: sent?.messages?.[0]?.id ?? null };
  }

  return { externalId: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Funciones ricas de WhatsApp: ubicación, reacciones, encuestas, editar, eliminar, leído.
// Cada una sabe qué canal las soporta. La API oficial (Cloud) no permite encuestas, editar ni
// eliminar para todos: en ese caso lanzan UnsupportedChannelError con un mensaje para el usuario.
// ─────────────────────────────────────────────────────────────────────────────

export class UnsupportedChannelError extends Error {}

type Provider =
  | { kind: "evolution"; instanceName: string }
  | { kind: "cloud"; phoneNumberId: string; accessToken: string };

type WhatsAppChannel = "WHATSAPP_PERSONAL" | "WHATSAPP";

async function resolveProvider(workspaceId: string, channel: string): Promise<Provider> {
  if (channel === "WHATSAPP_PERSONAL") {
    const integration = await prisma.integration.findFirst({ where: { workspaceId, type: "WHATSAPP_EVOLUTION", isActive: true } });
    const instanceName = (integration?.config as EvolutionConfig | undefined)?.instanceName;
    if (!instanceName) throw new UnsupportedChannelError("WhatsApp (Evolution) no está conectado.");
    return { kind: "evolution", instanceName };
  }
  if (channel === "WHATSAPP") {
    const config = await getWorkspaceWhatsAppCloudConfig(workspaceId);
    if (!config) throw new UnsupportedChannelError("WhatsApp oficial no está conectado.");
    return { kind: "cloud", phoneNumberId: config.phoneNumberId, accessToken: config.accessToken };
  }
  throw new UnsupportedChannelError("Esta acción solo está disponible en conversaciones de WhatsApp.");
}

export type OutboundLocation = { latitude: number; longitude: number; name: string; address: string };

export async function sendOutboundLocation(p: {
  workspaceId: string; channel: WhatsAppChannel; externalId: string; location: OutboundLocation;
}): Promise<{ externalId: string | null }> {
  const provider = await resolveProvider(p.workspaceId, p.channel);
  if (provider.kind === "evolution") {
    const sent = await evo.sendLocationMessage(provider.instanceName, p.externalId, p.location);
    return { externalId: sent?.key?.id ?? null };
  }
  const sent = await cloud.sendLocationMessage(provider.phoneNumberId, provider.accessToken, p.externalId, p.location);
  return { externalId: sent?.messages?.[0]?.id ?? null };
}

export async function sendOutboundReaction(p: {
  workspaceId: string; channel: WhatsAppChannel; remoteId: string; targetExternalId: string; targetFromMe: boolean; emoji: string;
}): Promise<void> {
  const provider = await resolveProvider(p.workspaceId, p.channel);
  if (provider.kind === "evolution") {
    await evo.sendReactionMessage(provider.instanceName, { remoteJid: p.remoteId, fromMe: p.targetFromMe, id: p.targetExternalId }, p.emoji);
    return;
  }
  await cloud.sendReactionMessage(provider.phoneNumberId, provider.accessToken, p.remoteId, p.targetExternalId, p.emoji);
}

export async function sendOutboundPoll(p: {
  workspaceId: string; channel: WhatsAppChannel; externalId: string; question: string; options: string[];
}): Promise<{ externalId: string | null }> {
  const provider = await resolveProvider(p.workspaceId, p.channel);
  if (provider.kind !== "evolution") throw new UnsupportedChannelError("Las encuestas no están disponibles en la API oficial de WhatsApp.");
  const sent = await evo.sendPollMessage(provider.instanceName, p.externalId, p.question, p.options);
  return { externalId: sent?.key?.id ?? null };
}

export async function editOutboundMessage(p: {
  workspaceId: string; channel: WhatsAppChannel; remoteId: string; targetExternalId: string; text: string;
}): Promise<void> {
  const provider = await resolveProvider(p.workspaceId, p.channel);
  if (provider.kind !== "evolution") throw new UnsupportedChannelError("Editar mensajes no está disponible en la API oficial de WhatsApp.");
  await evo.editMessage(provider.instanceName, p.remoteId, { remoteJid: p.remoteId, fromMe: true, id: p.targetExternalId }, p.text);
}

export async function deleteOutboundMessage(p: {
  workspaceId: string; channel: WhatsAppChannel; remoteId: string; targetExternalId: string;
}): Promise<void> {
  const provider = await resolveProvider(p.workspaceId, p.channel);
  if (provider.kind !== "evolution") throw new UnsupportedChannelError("Eliminar para todos no está disponible en la API oficial de WhatsApp.");
  await evo.deleteMessageForEveryone(provider.instanceName, { remoteJid: p.remoteId, fromMe: true, id: p.targetExternalId });
}

/** Avisa a WhatsApp que el equipo leyó estos mensajes entrantes (checks azules para el cliente). */
export async function markInboundMessagesRead(p: {
  workspaceId: string; channel: string; remoteId: string; externalIds: string[];
}): Promise<void> {
  if (!p.externalIds.length) return;
  const provider = await resolveProvider(p.workspaceId, p.channel);
  if (provider.kind === "evolution") {
    await evo.markMessagesAsRead(provider.instanceName, p.externalIds.map((id) => ({ remoteJid: p.remoteId, fromMe: false, id })));
    return;
  }
  // La API oficial marca de a un mensaje; basta el más reciente para marcar toda la conversación.
  await cloud.markMessageRead(provider.phoneNumberId, provider.accessToken, p.externalIds[p.externalIds.length - 1]);
}
