import { webhookHeadersFor } from "@/lib/evolution/webhook-auth";
const BASE_URL = process.env.EVOLUTION_API_URL ?? "";
const API_KEY = process.env.EVOLUTION_API_KEY ?? "";

async function evolutionFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: API_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Evolution API ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

export async function createInstance(instanceName: string, webhookUrl: string) {
  const result = (await evolutionFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
  })) as { qrcode?: { base64?: string; pairingCode?: string | null } };
  await setInstanceWebhook(instanceName, webhookUrl);
  return { base64: result.qrcode?.base64, pairingCode: result.qrcode?.pairingCode ?? null };
}

export async function setInstanceWebhook(instanceName: string, webhookUrl: string) {
  return evolutionFetch(`/webhook/set/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: { enabled: true, url: webhookUrl, headers: webhookHeadersFor(instanceName), base64: true, events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_EDITED", "MESSAGES_DELETE", "CONNECTION_UPDATE"] },
    }),
  });
}

export async function connectInstance(instanceName: string) {
  return evolutionFetch(`/instance/connect/${instanceName}`, { method: "GET" }) as Promise<{
    base64?: string;
    pairingCode?: string | null;
  }>;
}

export async function fetchConnectionState(instanceName: string) {
  return evolutionFetch(`/instance/connectionState/${instanceName}`, { method: "GET" }) as Promise<{
    instance: { instanceName: string; state: "open" | "connecting" | "close" };
  }>;
}

export async function deleteInstance(instanceName: string) {
  return evolutionFetch(`/instance/delete/${instanceName}`, { method: "DELETE" });
}

export async function markMessageAsRead(instanceName: string, remoteJid: string, messageId: string, fromMe: boolean) {
  return evolutionFetch(`/chat/markMessageAsRead/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ readMessages: [{ remoteJid, id: messageId, fromMe }] }),
  });
}

export async function sendPresence(instanceName: string, remoteJid: string, presence: "composing" | "paused") {
  return evolutionFetch(`/chat/sendPresence/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number: remoteJid, presence, delay: presence === "composing" ? 0 : 800 }),
  });
}

/** Descarga y descifra un mensaje de media (imagen/video/documento/audio) recibido por WhatsApp. */
export async function getBase64FromMediaMessage(instanceName: string, messageId: string) {
  return evolutionFetch(`/chat/getBase64FromMediaMessage/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ message: { key: { id: messageId } } }),
  }) as Promise<{ base64?: string; mimetype?: string }>;
}

export async function sendTextMessage(instanceName: string, remoteJid: string, text: string) {
  return evolutionFetch(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number: remoteJid, text }),
  }) as Promise<{ key?: { id?: string; remoteJid?: string; fromMe?: boolean } }>;
}

/** Envía una imagen/video/documento por URL — usado para mandar fotos de propiedades del inventario. */
export async function sendMediaMessage(
  instanceName: string,
  remoteJid: string,
  mediaUrl: string,
  mediaType: "image" | "video" | "document",
  caption?: string
) {
  return evolutionFetch(`/message/sendMedia/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      number: remoteJid,
      mediatype: mediaType,
      media: mediaUrl,
      ...(caption ? { caption } : {}),
    }),
  }) as Promise<{ key?: { id?: string; remoteJid?: string; fromMe?: boolean } }>;
}

/**
 * Envía un mensaje simulando comportamiento humano: marca el mensaje entrante
 * como leído, muestra "escribiendo..." un tiempo proporcional al largo de la
 * respuesta, y luego envía. Reduce el riesgo de baneo por patrones de bot.
 */
export async function sendWhatsAppReply(params: {
  instanceName: string;
  remoteJid: string;
  text: string;
  inboundMessageId?: string;
}) {
  const { instanceName, remoteJid, text, inboundMessageId } = params;

  if (inboundMessageId) {
    await markMessageAsRead(instanceName, remoteJid, inboundMessageId, false).catch(() => {});
  }

  await sendPresence(instanceName, remoteJid, "composing").catch(() => {});
  const typingMs = Math.min(4000, Math.max(800, text.length * 35 + Math.random() * 500));
  await new Promise((r) => setTimeout(r, typingMs));

  const result = await sendTextMessage(instanceName, remoteJid, text);

  await sendPresence(instanceName, remoteJid, "paused").catch(() => {});
  return result;
}

type EvolutionSendResult = { key?: { id?: string; remoteJid?: string; fromMe?: boolean } };
export type WaKey = { remoteJid: string; fromMe: boolean; id: string };

/** Marca varios mensajes entrantes como leídos de una sola vez (checks azules en el teléfono del cliente). */
export async function markMessagesAsRead(instanceName: string, keys: WaKey[]) {
  if (!keys.length) return;
  return evolutionFetch(`/chat/markMessageAsRead/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ readMessages: keys }),
  });
}

export async function sendLocationMessage(
  instanceName: string,
  remoteJid: string,
  loc: { latitude: number; longitude: number; name: string; address: string }
) {
  return evolutionFetch(`/message/sendLocation/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number: remoteJid, ...loc }),
  }) as Promise<EvolutionSendResult>;
}

/** `reaction` vacío ("") quita la reacción. */
export async function sendReactionMessage(instanceName: string, key: WaKey, reaction: string) {
  return evolutionFetch(`/message/sendReaction/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ key, reaction }),
  }) as Promise<EvolutionSendResult>;
}

export async function sendPollMessage(instanceName: string, remoteJid: string, question: string, options: string[], selectableCount = 1) {
  return evolutionFetch(`/message/sendPoll/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number: remoteJid, name: question, selectableCount, values: options }),
  }) as Promise<EvolutionSendResult>;
}

/** Editar un mensaje propio de texto (WhatsApp lo permite hasta ~15 minutos después de enviarlo). */
export async function editMessage(instanceName: string, remoteJid: string, key: WaKey, text: string) {
  return evolutionFetch(`/chat/updateMessage/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number: remoteJid, key, text }),
  });
}

/** "Eliminar para todos" (WhatsApp lo permite hasta ~2 días después). */
export async function deleteMessageForEveryone(instanceName: string, key: WaKey) {
  return evolutionFetch(`/chat/deleteMessageForEveryone/${instanceName}`, {
    method: "DELETE",
    body: JSON.stringify(key),
  });
}
