import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgentTurn } from "@/lib/agent/orchestrator";
import { getMediaUrl, downloadMedia, sendWhatsAppCloudReply } from "@/lib/whatsapp-cloud/graph-client";
import { getWorkspaceWhatsAppCloudConfig } from "@/lib/integrations/whatsapp-cloud-config";
import { verifyMetaSignature } from "@/lib/whatsapp-cloud/verify-signature";
import { applyMessageStatusUpdate, type ResolvedMessageStatus } from "@/lib/messaging/status";
import { scheduleTask, cancelScheduledTask } from "@/lib/jobs/scheduled-tasks";
import { fireAutomationTrigger } from "@/lib/jobs/run-automations";
import { getDefaultPipelineEntryStage } from "@/lib/leads/default-deal";
import { uploadMediaBuffer } from "@/lib/storage/upload-media-buffer";
import { transcribeAudioUrl } from "@/lib/openai/transcribe";

type CloudMediaPayload = { id: string; mime_type?: string; caption?: string; filename?: string };

type CloudMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  image?: CloudMediaPayload;
  video?: CloudMediaPayload;
  document?: CloudMediaPayload;
  audio?: CloudMediaPayload;
  sticker?: CloudMediaPayload;
};

type CloudStatus = { id: string; status: string };

type CloudChangeValue = {
  messaging_product: "whatsapp";
  metadata: { phone_number_id: string; display_phone_number?: string };
  contacts?: { profile?: { name?: string }; wa_id: string }[];
  messages?: CloudMessage[];
  statuses?: CloudStatus[];
};

type CloudWebhookBody = {
  object: string;
  entry: { id: string; changes: { field: string; value: CloudChangeValue }[] }[];
};

type MediaKind = "image" | "video" | "document" | "audio";

const MEDIA_PLACEHOLDER: Record<MediaKind, string> = {
  image: "📷 Imagen", video: "🎥 Video", document: "📄 Documento", audio: "🎤 Nota de voz",
};

function extractMedia(msg: CloudMessage): { kind: MediaKind; payload: CloudMediaPayload } | null {
  if (msg.image) return { kind: "image", payload: msg.image };
  if (msg.sticker) return { kind: "image", payload: msg.sticker };
  if (msg.video) return { kind: "video", payload: msg.video };
  if (msg.document) return { kind: "document", payload: msg.document };
  if (msg.audio) return { kind: "audio", payload: msg.audio };
  return null;
}

// Cloud API manda el status en minúsculas ("sent"/"delivered"/"read"/"failed") — coincide
// directo con nuestro enum, a diferencia de Evolution que necesita normalización.
function resolveMessageStatus(raw: string): ResolvedMessageStatus | null {
  const s = raw.toUpperCase();
  if (s === "SENT" || s === "DELIVERED" || s === "READ" || s === "FAILED") return s;
  return null;
}

/**
 * Meta llama a este endpoint con GET una vez, al configurar el webhook (o al
 * "Comprobar webhooks de prueba"), para confirmar que somos dueños de la URL.
 * Hay que devolver el hub.challenge tal cual, como texto plano.
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(rawBody) as CloudWebhookBody;
  if (body.object !== "whatsapp_business_account") return NextResponse.json({ ok: true });

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      await handleChangeValue(change.value);
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleChangeValue(value: CloudChangeValue) {
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId) return;

  const integration = await prisma.integration.findFirst({
    where: { type: "WHATSAPP_CLOUD", config: { path: ["phoneNumberId"], equals: phoneNumberId } },
  });
  if (!integration) return;

  for (const status of value.statuses ?? []) {
    const resolved = resolveMessageStatus(status.status);
    if (resolved) await applyMessageStatusUpdate(status.id, resolved);
  }

  for (const message of value.messages ?? []) {
    await handleInboundMessage(integration.workspaceId, message, value.contacts);
  }
}

async function handleInboundMessage(workspaceId: string, message: CloudMessage, contacts: CloudChangeValue["contacts"]) {
  const text = message.text?.body?.trim() ?? "";
  const media = extractMedia(message);
  const phone = message.from;
  if ((!text && !media) || !phone) return;

  // Meta puede reentregar el mismo evento más de una vez — sin este dedup se
  // duplicaría el mensaje y, si fuera un turno del bot, respondería dos veces.
  const alreadyProcessed = await prisma.message.findFirst({ where: { externalId: message.id, channel: "WHATSAPP" } });
  if (alreadyProcessed) return;

  let lead = await prisma.lead.findFirst({ where: { workspaceId, phone } });
  if (!lead) {
    const pushName = contacts?.find((c) => c.wa_id === phone)?.profile?.name;
    const entryStage = await getDefaultPipelineEntryStage(workspaceId);
    lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: { workspaceId, firstName: pushName?.trim() || phone, phone, source: "WHATSAPP", stage: "Nuevo", score: 0 },
      });
      if (entryStage) {
        await tx.deal.create({
          data: { workspaceId, leadId: created.id, pipelineId: entryStage.pipelineId, stageId: entryStage.stageId, currency: "DOP" },
        });
      }
      return created;
    });
    await fireAutomationTrigger(workspaceId, "LEAD_CREATED", { leadId: lead.id });
  }

  let conversation = await prisma.conversation.findFirst({ where: { workspaceId, leadId: lead.id, channel: "WHATSAPP" } });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { workspaceId, leadId: lead.id, channel: "WHATSAPP", externalId: phone, status: "OPEN", isAiHandled: true },
    });
  }

  let mediaUrl: string | null = null;
  let mediaType: MediaKind | null = null;
  let content = text;

  if (media) {
    const config = await getWorkspaceWhatsAppCloudConfig(workspaceId);
    if (config) {
      try {
        const info = await getMediaUrl(media.payload.id, config.accessToken);
        if (info.url) {
          const buffer = await downloadMedia(info.url, config.accessToken);
          const mimetype = info.mime_type || media.payload.mime_type || "application/octet-stream";
          mediaUrl = await uploadMediaBuffer(buffer, mimetype);
          mediaType = media.kind;
        }
      } catch (err) {
        console.error("Fallo descargando/subiendo adjunto de WhatsApp Cloud API:", err);
      }
    }
    if (!content) {
      content = media.kind === "document" ? (media.payload.filename || MEDIA_PLACEHOLDER.document)
        : media.payload.caption || MEDIA_PLACEHOLDER[media.kind];
    }
    if (media.kind === "audio" && mediaUrl) {
      const primaryAgent = await prisma.aIAgent.findFirst({
        where: { workspaceId, isPrimary: true, respondToVoiceNotes: true },
        select: { id: true },
      });
      if (primaryAgent) {
        const transcript = await transcribeAudioUrl(workspaceId, mediaUrl).catch((err) => {
          console.error("Fallo transcribiendo nota de voz de WhatsApp Cloud API:", err);
          return null;
        });
        if (transcript) content = transcript;
      }
    }
    if (!content) content = MEDIA_PLACEHOLDER[media.kind];
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id, direction: "INBOUND", channel: "WHATSAPP",
      content, mediaUrl, mediaType, isRead: false, externalId: message.id,
    },
  });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

  await cancelScheduledTask(`followup:${conversation.id}`);

  if (!conversation.isAiHandled) {
    await fireAutomationTrigger(workspaceId, "MESSAGE_RECEIVED", { leadId: lead.id, conversationId: conversation.id });
    return;
  }

  const agent = await prisma.aIAgent.findFirst({ where: { workspaceId, isPrimary: true, status: "AUTO_PILOT" } });
  if (!agent) return;

  if (agent.waitTimeValue <= 0) {
    const result = await runAgentTurn(agent.id, conversation.id);
    if (!result.reply) return;

    const config = await getWorkspaceWhatsAppCloudConfig(workspaceId);
    if (!config) return;
    const sent = await sendWhatsAppCloudReply({
      phoneNumberId: config.phoneNumberId, accessToken: config.accessToken, to: phone, text: result.reply,
    }).catch((err) => {
      console.error("Fallo enviando respuesta por WhatsApp Cloud API:", err);
      return null;
    });
    const waMessageId = sent?.messages?.[0]?.id;
    if (waMessageId && result.messageId) {
      await prisma.message.update({ where: { id: result.messageId }, data: { externalId: waMessageId } });
    }
  } else {
    const delayMs = agent.waitTimeUnit === "MINUTES" ? agent.waitTimeValue * 60_000 : agent.waitTimeValue * 1000;
    await scheduleTask({
      workspaceId,
      type: "AGENT_REPLY_BUFFER",
      payload: { conversationId: conversation.id, agentId: agent.id },
      runAt: new Date(Date.now() + delayMs),
      dedupeKey: `agent-buffer:${conversation.id}`,
    });
  }
}
