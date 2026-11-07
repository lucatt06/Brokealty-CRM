"use server";

import { assertOwns, requireCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendOutboundWhatsApp } from "@/lib/messaging/send-outbound";
import { cancelScheduledTask } from "@/lib/jobs/scheduled-tasks";
import { getWorkspaceResendConfig } from "@/lib/integrations/resend-config";
import { sendEmail } from "@/lib/resend/client";

export type Channel = "WHATSAPP" | "WHATSAPP_PERSONAL" | "FACEBOOK" | "INSTAGRAM" | "SMS" | "EMAIL" | "LLAMADA" | "INTERNO";

export async function sendMessage(conversationId: string, channel: Channel, content: string) {
  const ctx = await requireCtx();
  await assertOwns("conversation", conversationId, ctx.workspace.id);
  const trimmed = content.trim();
  if (!trimmed) return;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      workspaceId: true, leadId: true, externalId: true, channel: true, isAiHandled: true,
      lead: { select: { email: true, firstName: true } },
      workspace: { select: { name: true } },
    },
  });
  if (!conversation) throw new Error("Conversación no encontrada");

  // Si el agente principal tiene "dormir al enviar mensaje manual" activo, un mensaje
  // escrito a mano por el inmobiliaria pausa al bot en esta conversación (mismo mecanismo
  // que Stop Bot / Human Handover: isAiHandled = false).
  const shouldSleep = conversation.isAiHandled
    ? Boolean(
        (
          await prisma.aIAgent.findFirst({
            where: { workspaceId: conversation.workspaceId, isPrimary: true },
            select: { sleepOnManualMessage: true },
          })
        )?.sleepOnManualMessage
      )
    : false;

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { conversationId, direction: "OUTBOUND", channel, content: trimmed, isRead: true },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), ...(shouldSleep ? { isAiHandled: false } : {}) },
    });
    if (conversation.leadId) {
      await tx.activity.create({
        data: { workspaceId: conversation.workspaceId, leadId: conversation.leadId, type: "MESSAGE_SENT", description: "Mensaje enviado" },
      });
    }
    return created;
  });

  if ((conversation.channel === "WHATSAPP_PERSONAL" || conversation.channel === "WHATSAPP") && conversation.externalId) {
    const { externalId } = await sendOutboundWhatsApp({
      workspaceId: conversation.workspaceId,
      channel: conversation.channel,
      externalId: conversation.externalId,
      text: trimmed,
    });
    if (externalId) {
      await prisma.message.update({ where: { id: message.id }, data: { externalId } });
    }
  }

  if (conversation.channel === "EMAIL" && conversation.lead?.email) {
    const resendConfig = await getWorkspaceResendConfig(conversation.workspaceId);
    if (resendConfig) {
      await sendEmail({
        apiKey: resendConfig.apiKey,
        from: resendConfig.fromEmail,
        to: conversation.lead.email,
        subject: `Mensaje de ${conversation.workspace?.name ?? "tu inmobiliaria"}`,
        html: trimmed.replace(/\n/g, "<br>"),
      }).catch((err) => {
        console.error("Fallo enviando email manual por Resend:", err);
      });
    }
  }

  revalidatePath("/conversaciones");
}

export async function setConversationAiHandled(conversationId: string, isAiHandled: boolean) {
  const ctx = await requireCtx();
  await assertOwns("conversation", conversationId, ctx.workspace.id);
  await prisma.conversation.update({ where: { id: conversationId }, data: { isAiHandled } });
  // El toggle manual es la señal más fuerte — cancela cualquier reactivación automática
  // pendiente (Stop Bot / Human Handover) para que no le pise la decisión del inmobiliaria.
  await cancelScheduledTask(`reactivate:${conversationId}`);
  revalidatePath("/conversaciones");
}

export async function markConversationRead(conversationId: string) {
  const ctx = await requireCtx();
  await assertOwns("conversation", conversationId, ctx.workspace.id);
  await prisma.message.updateMany({
    where: {
      conversationId,
      direction: "INBOUND",
      isRead: false,
    },
    data: { isRead: true },
  });
  revalidatePath("/conversaciones");
  revalidatePath("/");
}

export async function sendVoiceNote(conversationId: string, channel: Channel, mediaUrl: string) {
  const ctx = await requireCtx();
  await assertOwns("conversation", conversationId, ctx.workspace.id);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { workspaceId: true, leadId: true },
  });
  if (!conversation) throw new Error("Conversación no encontrada");

  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        direction: "OUTBOUND",
        channel,
        content: "🎤 Nota de voz",
        mediaUrl,
        mediaType: "audio",
        isRead: true,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
    ...(conversation.leadId
      ? [prisma.activity.create({
          data: {
            workspaceId: conversation.workspaceId,
            leadId: conversation.leadId,
            type: "MESSAGE_SENT",
            description: "Nota de voz enviada",
          },
        })]
      : []),
  ]);

  revalidatePath("/conversaciones");
}
