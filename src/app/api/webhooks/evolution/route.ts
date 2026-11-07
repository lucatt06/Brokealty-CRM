import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgentTurn } from "@/lib/agent/orchestrator";
import { sendWhatsAppReply, getBase64FromMediaMessage } from "@/lib/evolution/client";
import { scheduleTask, cancelScheduledTask } from "@/lib/jobs/scheduled-tasks";
import { fireAutomationTrigger } from "@/lib/jobs/run-automations";
import { getDefaultPipelineEntryStage } from "@/lib/leads/default-deal";
import { uploadMediaBuffer } from "@/lib/storage/upload-media-buffer";
import { transcribeAudioUrl } from "@/lib/openai/transcribe";
import { applyMessageStatusUpdate, type ResolvedMessageStatus } from "@/lib/messaging/status";

type EvolutionMediaPayload = { mimetype?: string; caption?: string; fileName?: string };

type EvolutionMessageUpsertBody = {
  event: string;
  instance: string;
  data: {
    key: { remoteJid: string; fromMe: boolean; id: string };
    pushName?: string;
    message?: {
      conversation?: string; extendedTextMessage?: { text?: string };
      imageMessage?: EvolutionMediaPayload;
      videoMessage?: EvolutionMediaPayload;
      documentMessage?: EvolutionMediaPayload;
      audioMessage?: EvolutionMediaPayload;
      stickerMessage?: EvolutionMediaPayload;
    };
  };
};

function extractText(data: EvolutionMessageUpsertBody["data"]) {
  return data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? "";
}

type MediaKind = "image" | "video" | "document" | "audio";

const MEDIA_PLACEHOLDER: Record<MediaKind, string> = {
  image: "📷 Imagen", video: "🎥 Video", document: "📄 Documento", audio: "🎤 Nota de voz",
};

/** Detecta si el mensaje trae un adjunto (imagen/video/documento/audio/sticker — el sticker se trata como imagen). */
function extractMedia(data: EvolutionMessageUpsertBody["data"]): { kind: MediaKind; payload: EvolutionMediaPayload } | null {
  const m = data.message;
  if (!m) return null;
  if (m.imageMessage) return { kind: "image", payload: m.imageMessage };
  if (m.stickerMessage) return { kind: "image", payload: m.stickerMessage };
  if (m.videoMessage) return { kind: "video", payload: m.videoMessage };
  if (m.documentMessage) return { kind: "document", payload: m.documentMessage };
  if (m.audioMessage) return { kind: "audio", payload: m.audioMessage };
  return null;
}

type EvolutionConnectionUpdateBody = {
  event: string;
  instance: string;
  data: { state: "open" | "connecting" | "close" };
};

// Evolution API (Baileys) manda actualizaciones de estado con formas ligeramente distintas
// según la versión: a veces un string ("DELIVERY_ACK"/"READ"), a veces el ACK numérico de
// Baileys (2=enviado al servidor, 3=entregado, 4/5=leído/reproducido). Se cubren ambas.
type EvolutionMessageUpdateEntry = {
  keyId?: string;
  key?: { id?: string };
  status?: string | number;
  update?: { status?: string | number };
};

type EvolutionMessageUpdateBody = {
  event: string;
  instance: string;
  data: EvolutionMessageUpdateEntry | EvolutionMessageUpdateEntry[];
};

function resolveMessageStatus(raw: string | number | undefined): ResolvedMessageStatus | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") {
    if (raw <= 0) return "FAILED";
    if (raw === 2) return "SENT";
    if (raw === 3) return "DELIVERED";
    if (raw >= 4) return "READ";
    return null;
  }
  const s = raw.toUpperCase();
  if (s.includes("READ") || s.includes("PLAYED")) return "READ";
  if (s.includes("DELIVERY") || s === "DELIVERED") return "DELIVERED";
  if (s.includes("SERVER_ACK") || s === "SENT") return "SENT";
  if (s.includes("ERROR") || s === "FAILED") return "FAILED";
  return null;
}

async function handleMessageUpdate(body: EvolutionMessageUpdateBody) {
  const entries = Array.isArray(body.data) ? body.data : [body.data];
  for (const entry of entries) {
    const waMessageId = entry.keyId ?? entry.key?.id;
    const status = resolveMessageStatus(entry.status ?? entry.update?.status);
    if (!waMessageId || !status) continue;
    await applyMessageStatusUpdate(waMessageId, status);
  }
}

async function handleConnectionUpdate(body: EvolutionConnectionUpdateBody) {
  const integration = await prisma.integration.findFirst({
    where: { type: "WHATSAPP_EVOLUTION", config: { path: ["instanceName"], equals: body.instance } },
  });
  if (!integration) return;

  const config = integration.config as Record<string, unknown>;
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      isActive: body.data.state === "open",
      config: { ...config, connected: body.data.state === "open", lastState: body.data.state },
    },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as EvolutionMessageUpsertBody | EvolutionConnectionUpdateBody | EvolutionMessageUpdateBody;

  if (body.event === "connection.update") {
    await handleConnectionUpdate(body as EvolutionConnectionUpdateBody);
    return NextResponse.json({ ok: true });
  }

  if (body.event === "messages.update") {
    await handleMessageUpdate(body as EvolutionMessageUpdateBody);
    return NextResponse.json({ ok: true });
  }

  if (body.event !== "messages.upsert") return NextResponse.json({ ok: true });

  const { data, instance } = body as EvolutionMessageUpsertBody;
  if (!data?.key) return NextResponse.json({ ok: true });

  // fromMe:true normalmente es el eco de un mensaje que YA enviamos nosotros mismos
  // (sendMessage/orchestrator) — ese caso se descarta más abajo por el dedup de externalId.
  // Pero también puede ser un mensaje que el dealer escribió directo en WhatsApp desde el
  // teléfono conectado, sin pasar por el CRM — ese sí hay que registrarlo (como OUTBOUND,
  // sin disparar respuesta del bot) para que la conversación no quede incompleta.
  const isFromMe = data.key.fromMe;

  const text = extractText(data).trim();
  const media = extractMedia(data);
  const remoteJid = data.key.remoteJid;
  const phone = remoteJid?.split("@")[0];
  if ((!text && !media) || !phone) return NextResponse.json({ ok: true });

  const integration = await prisma.integration.findFirst({
    where: { type: "WHATSAPP_EVOLUTION", config: { path: ["instanceName"], equals: instance } },
  });
  if (!integration) return NextResponse.json({ ok: true, warning: "instancia no reconocida" });

  // Evolution (y en general cualquier proveedor de webhooks) puede reentregar el mismo evento
  // más de una vez, y además reenvía el mismo mensaje fromMe:true que nosotros ya enviamos.
  // Sin este dedup, un reintento (o el eco de nuestro propio envío) generaría un mensaje
  // duplicado y, si fuera inbound, una segunda respuesta real del bot por WhatsApp.
  const alreadyProcessed = await prisma.message.findFirst({
    where: { externalId: data.key.id, channel: "WHATSAPP_PERSONAL" },
  });
  if (alreadyProcessed) return NextResponse.json({ ok: true, duplicate: true });

  const workspaceId = integration.workspaceId;

  let lead = await prisma.lead.findFirst({ where: { workspaceId, phone } });
  if (!lead) {
    const entryStage = await getDefaultPipelineEntryStage(workspaceId);
    lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          workspaceId,
          firstName: isFromMe ? phone : (data.pushName?.trim() || phone),
          phone,
          source: "WHATSAPP",
          stage: "Nuevo",
          score: 0,
        },
      });
      // Todo contacto nuevo entra al pipeline en su primera etapa.
      if (entryStage) {
        await tx.deal.create({
          data: {
            workspaceId, leadId: created.id,
            pipelineId: entryStage.pipelineId, stageId: entryStage.stageId,
            currency: "DOP",
          },
        });
      }
      return created;
    });
    await fireAutomationTrigger(workspaceId, "LEAD_CREATED", { leadId: lead.id });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { workspaceId, leadId: lead.id, channel: "WHATSAPP_PERSONAL" },
  });
  if (!conversation) {
    // isAiHandled arranca en true — una conversación nueva la debe manejar el bot
    // (si hay un agente primario en Auto Pilot para este canal) hasta que algo la
    // pause explícitamente (mensaje manual, Stop Bot, Human Handover, etc.).
    conversation = await prisma.conversation.create({
      data: { workspaceId, leadId: lead.id, channel: "WHATSAPP_PERSONAL", externalId: remoteJid, status: "OPEN", isAiHandled: true },
    });
  }

  // Descarga y sube el adjunto (si lo hay) — Evolution guarda la media cifrada del lado
  // de WhatsApp; este endpoint la descifra y la devuelve en base64.
  let mediaUrl: string | null = null;
  let mediaType: MediaKind | null = null;
  let content = text;
  if (media) {
    try {
      const downloaded = await getBase64FromMediaMessage(instance, data.key.id);
      if (downloaded.base64) {
        const mimetype = downloaded.mimetype || media.payload.mimetype || "application/octet-stream";
        mediaUrl = await uploadMediaBuffer(Buffer.from(downloaded.base64, "base64"), mimetype);
        mediaType = media.kind;
      }
    } catch (err) {
      console.error("Fallo descargando/subiendo adjunto de WhatsApp:", err);
    }
    if (!content) {
      content = media.kind === "document" ? (media.payload.fileName || MEDIA_PLACEHOLDER.document)
        : media.payload.caption || MEDIA_PLACEHOLDER[media.kind];
    }
    // Nota de voz entrante: si el agente principal tiene "responder a notas de voz"
    // activo, se transcribe una sola vez aquí (no en cada turno del bot) y el texto
    // transcrito pasa a ser el contenido del mensaje — así el bot la "escucha" como
    // cualquier otro mensaje de texto, sin lógica especial en el orquestador.
    if (media.kind === "audio" && mediaUrl && !isFromMe) {
      const primaryAgent = await prisma.aIAgent.findFirst({
        where: { workspaceId, isPrimary: true, respondToVoiceNotes: true },
        select: { id: true },
      });
      if (primaryAgent) {
        const transcript = await transcribeAudioUrl(workspaceId, mediaUrl).catch((err) => {
          console.error("Fallo transcribiendo nota de voz de WhatsApp:", err);
          return null;
        });
        if (transcript) content = transcript;
      }
    }
    if (!content) content = MEDIA_PLACEHOLDER[media.kind];
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: isFromMe ? "OUTBOUND" : "INBOUND",
      channel: "WHATSAPP_PERSONAL",
      content,
      mediaUrl,
      mediaType,
      isRead: isFromMe,
      externalId: data.key.id,
    },
  });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

  // Si el contacto realmente respondió, cualquier follow-up proactivo pendiente ya no
  // aplica — se cancela para no mandar un recordatorio de "no has respondido" después
  // de que ya respondió.
  if (!isFromMe) {
    await cancelScheduledTask(`followup:${conversation.id}`);
  }

  // MESSAGE_RECEIVED solo dispara cuando el bot está apagado en esta conversación — así
  // nunca compite con la respuesta del propio agente (que ya reacciona a estos mensajes
  // por su cuenta). Sirve para casos como "avisar al equipo si el cliente escribe con el
  // bot pausado".
  if (!isFromMe && !conversation.isAiHandled) {
    await fireAutomationTrigger(workspaceId, "MESSAGE_RECEIVED", { leadId: lead.id, conversationId: conversation.id });
  }

  // Un mensaje mandado a mano desde el teléfono no debe disparar al bot — solo respondemos
  // a mensajes que realmente vinieron del contacto.
  if (!isFromMe && conversation.isAiHandled) {
    const agent = await prisma.aIAgent.findFirst({
      where: { workspaceId, isPrimary: true, status: "AUTO_PILOT" },
    });
    const instanceName = (integration.config as { instanceName?: string }).instanceName;
    if (agent && instanceName) {
      if (agent.waitTimeValue <= 0) {
        // waitTimeValue=0 → responder de inmediato, sin pasar por el buffer (comportamiento
        // idéntico al de antes de la Fase B, para quien no quiera el delay).
        const result = await runAgentTurn(agent.id, conversation.id);
        if (result.reply) {
          const sent = await sendWhatsAppReply({
            instanceName,
            remoteJid,
            text: result.reply,
            inboundMessageId: data.key.id,
          }).catch((err) => {
            console.error("Fallo enviando respuesta por Evolution:", err);
            return null;
          });
          const waMessageId = sent?.key?.id;
          if (waMessageId && result.messageId) {
            await prisma.message.update({ where: { id: result.messageId }, data: { externalId: waMessageId } });
          }
        }
      } else {
        // dedupeKey por conversación: si llegan varios mensajes seguidos, cada uno
        // reprograma la misma tarea en vez de crear una respuesta por mensaje.
        const delayMs = agent.waitTimeUnit === "MINUTES" ? agent.waitTimeValue * 60_000 : agent.waitTimeValue * 1000;
        await scheduleTask({
          workspaceId,
          type: "AGENT_REPLY_BUFFER",
          payload: { conversationId: conversation.id, agentId: agent.id, remoteJid, instanceName },
          runAt: new Date(Date.now() + delayMs),
          dedupeKey: `agent-buffer:${conversation.id}`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
