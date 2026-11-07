import { prisma } from "@/lib/prisma";
import type { AgentToolDefinition } from "../types";
import { sendOutboundWhatsAppMedia } from "@/lib/messaging/send-outbound";

// Límite defensivo: si una propiedad tiene 20 fotos cargadas, no queremos saturar
// el chat del contacto ni disparar 20 llamadas seguidas al proveedor de WhatsApp.
const MAX_PHOTOS = 6;

export const sendPropertyPhotosTool: AgentToolDefinition = {
  key: "send_property_photos",
  anthropicSchema: {
    name: "send_property_photos",
    description:
      "Envía las fotos de una propiedad del inventario al contacto, por el mismo canal de la conversación actual. " +
      "Usa primero search_inventory para encontrar el id de la propiedad correcto antes de llamar a esta herramienta.",
    input_schema: {
      type: "object",
      properties: {
        propertyId: { type: "string", description: "id de la propiedad (obtenido de search_inventory)" },
      },
      required: ["propertyId"],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { propertyId?: string };
    if (!ctx.conversationId) return "No hay conversación asociada; no se pudieron enviar las fotos.";
    if (!input.propertyId) return "Falta el id de la propiedad.";

    const property = await prisma.property.findFirst({
      where: { id: input.propertyId, workspaceId: ctx.workspaceId },
      include: { photos: { orderBy: [{ isPrimary: "desc" }, { order: "asc" }] } },
    });
    if (!property) return "No se encontró esa propiedad en el inventario (verifica el id con search_inventory).";
    if (!property.photos.length) return `La propiedad ${property.title} no tiene fotos cargadas todavía.`;

    const conversation = await prisma.conversation.findUnique({ where: { id: ctx.conversationId } });
    if (!conversation) return "Conversación no encontrada.";

    const caption = `${property.title}`;
    const canSendExternally = (conversation.channel === "WHATSAPP_PERSONAL" || conversation.channel === "WHATSAPP") && !!conversation.externalId;
    const photosToSend = property.photos.slice(0, MAX_PHOTOS);

    let sent = 0;
    for (const photo of photosToSend) {
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id, direction: "OUTBOUND", channel: conversation.channel,
          content: sent === 0 ? caption : "", mediaUrl: photo.url, mediaType: "image", isRead: true,
        },
      });

      if (canSendExternally) {
        const { externalId } = await sendOutboundWhatsAppMedia({
          workspaceId: ctx.workspaceId,
          channel: conversation.channel as "WHATSAPP_PERSONAL" | "WHATSAPP",
          externalId: conversation.externalId!,
          mediaUrl: photo.url,
          caption: sent === 0 ? caption : undefined,
        });
        if (externalId) await prisma.message.update({ where: { id: message.id }, data: { externalId } });
      }
      sent++;
    }

    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

    const omitted = property.photos.length - photosToSend.length;
    return `Se enviaron ${sent} foto(s) del ${property.title}.` +
      (omitted > 0 ? ` (${omitted} foto(s) adicional(es) no se enviaron por el límite de ${MAX_PHOTOS}).` : "");
  },
};
