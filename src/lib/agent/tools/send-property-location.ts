import { prisma } from "@/lib/prisma";
import type { AgentToolDefinition } from "../types";
import { sendOutboundLocation } from "@/lib/messaging/send-outbound";

export const sendPropertyLocationTool: AgentToolDefinition = {
  key: "send_property_location",
  anthropicSchema: {
    name: "send_property_location",
    description:
      "Envía al contacto la ubicación (pin de mapa) de una propiedad del catálogo por WhatsApp. " +
      "Úsala cuando el cliente pregunte dónde queda o pida la ubicación. " +
      "Usa primero search_inventory para obtener el id de la propiedad.",
    input_schema: {
      type: "object",
      properties: { propertyId: { type: "string", description: "id de la propiedad (obtenido de search_inventory)" } },
      required: ["propertyId"],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { propertyId?: string };
    if (!input.propertyId) return "Falta el id de la propiedad.";

    const property = await prisma.property.findFirst({
      where: { id: input.propertyId, workspaceId: ctx.workspaceId },
      select: { title: true, sector: true, city: true, latitude: true, longitude: true },
    });
    if (!property) return "No se encontró esa propiedad en el catálogo (verifica el id con search_inventory).";
    if (property.latitude == null || property.longitude == null) {
      return `La propiedad "${property.title}" no tiene coordenadas cargadas; indícale al cliente la zona (${[property.sector, property.city].filter(Boolean).join(", ") || "sin zona registrada"}) y que un asesor le enviará la ubicación exacta.`;
    }

    const conversation = ctx.conversationId ? await prisma.conversation.findUnique({ where: { id: ctx.conversationId } }) : null;
    if (!conversation) return "No hay conversación asociada; no se pudo enviar la ubicación.";
    if ((conversation.channel !== "WHATSAPP_PERSONAL" && conversation.channel !== "WHATSAPP") || !conversation.externalId) {
      return "Esta conversación no es de WhatsApp; no se puede enviar un pin de mapa. Comparte el enlace: " +
        `https://www.google.com/maps?q=${property.latitude},${property.longitude}`;
    }

    const location = {
      latitude: property.latitude, longitude: property.longitude, name: property.title,
      address: [property.sector, property.city].filter(Boolean).join(", ") || property.title,
    };
    const { externalId } = await sendOutboundLocation({
      workspaceId: ctx.workspaceId, channel: conversation.channel, externalId: conversation.externalId, location,
    }).catch((err) => {
      console.error("Fallo enviando ubicación:", err instanceof Error ? err.message : err);
      return { externalId: null as string | null, failed: true };
    }) as { externalId: string | null; failed?: boolean };
    if (!externalId) return "No se pudo enviar la ubicación por WhatsApp en este momento.";

    await prisma.message.create({
      data: {
        conversationId: conversation.id, direction: "OUTBOUND", channel: conversation.channel, isRead: true, externalId,
        content: `📍 ${location.name}\n${location.address}\nhttps://www.google.com/maps?q=${location.latitude},${location.longitude}`,
        mediaType: "location", meta: location,
      },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
    return `Se envió la ubicación de "${property.title}" al contacto.`;
  },
};
