import { prisma } from "@/lib/prisma";
import type { AgentToolDefinition } from "../types";
import { sendOutboundWhatsAppMedia } from "@/lib/messaging/send-outbound";

// Límite defensivo: si un vehículo tiene 20 fotos cargadas, no queremos saturar
// el chat del contacto ni disparar 20 llamadas seguidas al proveedor de WhatsApp.
const MAX_PHOTOS = 6;

export const sendVehiclePhotosTool: AgentToolDefinition = {
  key: "send_vehicle_photos",
  anthropicSchema: {
    name: "send_vehicle_photos",
    description:
      "Envía las fotos de un vehículo del inventario al contacto, por el mismo canal de la conversación actual. " +
      "Usa primero search_inventory para encontrar el id del vehículo correcto antes de llamar a esta herramienta.",
    input_schema: {
      type: "object",
      properties: {
        vehicleId: { type: "string", description: "id del vehículo (obtenido de search_inventory)" },
      },
      required: ["vehicleId"],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { vehicleId?: string };
    if (!ctx.conversationId) return "No hay conversación asociada; no se pudieron enviar las fotos.";
    if (!input.vehicleId) return "Falta el id del vehículo.";

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: input.vehicleId, workspaceId: ctx.workspaceId },
      include: { photos: { orderBy: [{ isPrimary: "desc" }, { order: "asc" }] } },
    });
    if (!vehicle) return "No se encontró ese vehículo en el inventario (verifica el id con search_inventory).";
    if (!vehicle.photos.length) return `El ${vehicle.make} ${vehicle.model} ${vehicle.year} no tiene fotos cargadas todavía.`;

    const conversation = await prisma.conversation.findUnique({ where: { id: ctx.conversationId } });
    if (!conversation) return "Conversación no encontrada.";

    const caption = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;
    const canSendExternally = (conversation.channel === "WHATSAPP_PERSONAL" || conversation.channel === "WHATSAPP") && !!conversation.externalId;
    const photosToSend = vehicle.photos.slice(0, MAX_PHOTOS);

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

    const omitted = vehicle.photos.length - photosToSend.length;
    return `Se enviaron ${sent} foto(s) del ${vehicle.make} ${vehicle.model} ${vehicle.year}.` +
      (omitted > 0 ? ` (${omitted} foto(s) adicional(es) no se enviaron por el límite de ${MAX_PHOTOS}).` : "");
  },
};
