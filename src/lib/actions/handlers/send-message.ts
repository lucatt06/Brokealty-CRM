import { prisma } from "@/lib/prisma";
import type { ActionDefinition } from "../types";
import { sendOutboundWhatsApp } from "@/lib/messaging/send-outbound";
import { getWorkspaceResendConfig } from "@/lib/integrations/resend-config";
import { sendEmail } from "@/lib/resend/client";

export const sendMessageAction: ActionDefinition = {
  key: "send_message",
  // anthropicSchema presente solo para que el paso autónomo AI_AGENT_STEP pueda
  // usarla si el autor de la automatización la incluye en allowedActionKeys — el
  // agente conversacional normal no la usa (ya responde por su cuenta en el chat).
  anthropicSchema: {
    name: "send_message",
    description: "Envía un mensaje al contacto por el canal de la conversación actual.",
    input_schema: {
      type: "object",
      properties: { content: { type: "string", description: "Texto del mensaje a enviar" } },
      required: ["content"],
    },
  },
  execute: async (rawInput, ctx) => {
    if (!ctx.conversationId) return "No hay conversación asociada; no se pudo enviar el mensaje.";
    const input = rawInput as { content?: string };
    const content = String(input.content ?? "").trim();
    if (!content) return "El contenido del mensaje está vacío.";

    const conversation = await prisma.conversation.findUnique({
      where: { id: ctx.conversationId },
      include: { lead: { select: { email: true } }, workspace: { select: { name: true } } },
    });
    if (!conversation) return "Conversación no encontrada.";

    await prisma.message.create({
      data: { conversationId: conversation.id, direction: "OUTBOUND", channel: conversation.channel, content, isRead: true },
    });

    // Igual que sleepOnManualMessage (Fase C) pero para mensajes que manda una
    // automatización ("mensaje de workflow"): mismo mecanismo, isAiHandled = false.
    const shouldSleep = conversation.isAiHandled
      ? Boolean(
          (
            await prisma.aIAgent.findFirst({
              where: { workspaceId: ctx.workspaceId, isPrimary: true },
              select: { sleepOnWorkflowMessage: true },
            })
          )?.sleepOnWorkflowMessage
        )
      : false;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), ...(shouldSleep ? { isAiHandled: false } : {}) },
    });

    if ((conversation.channel === "WHATSAPP_PERSONAL" || conversation.channel === "WHATSAPP") && conversation.externalId) {
      await sendOutboundWhatsApp({
        workspaceId: ctx.workspaceId,
        channel: conversation.channel,
        externalId: conversation.externalId,
        text: content,
      });
    }

    if (conversation.channel === "EMAIL" && conversation.lead?.email) {
      const resendConfig = await getWorkspaceResendConfig(ctx.workspaceId);
      if (resendConfig) {
        await sendEmail({
          apiKey: resendConfig.apiKey,
          from: resendConfig.fromEmail,
          to: conversation.lead.email,
          subject: `Mensaje de ${conversation.workspace?.name ?? "tu dealer"}`,
          html: content.replace(/\n/g, "<br>"),
        }).catch((err) => {
          console.error("Fallo enviando email por Resend (automatización):", err);
        });
      }
    }

    return "Mensaje enviado.";
  },
};
