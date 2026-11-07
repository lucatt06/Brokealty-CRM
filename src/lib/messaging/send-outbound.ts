import { prisma } from "@/lib/prisma";
import { sendWhatsAppReply, sendMediaMessage } from "@/lib/evolution/client";
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

/** Igual que sendOutboundWhatsApp pero para una foto/imagen — usado por send_vehicle_photos. */
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
