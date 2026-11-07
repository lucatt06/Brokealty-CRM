import { prisma } from "@/lib/prisma";
import { LISTING_TYPE_LABELS, PROPERTY_TYPE_LABELS, propertyLocation, propertySpecs } from "@/lib/properties/labels";
import type { ListingType, PropertyType } from "@prisma/client";
import type { AgentToolDefinition } from "../types";

const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_LABELS);
const LISTING_TYPES = Object.keys(LISTING_TYPE_LABELS);

export const searchInventoryTool: AgentToolDefinition = {
  key: "search_inventory",
  anthropicSchema: {
    name: "search_inventory",
    description:
      "Busca propiedades disponibles en el catálogo de la inmobiliaria, filtrando por tipo, operación (venta/alquiler), zona, habitaciones o precio máximo. " +
      "Úsala para responder qué propiedades hay disponibles, y para obtener el id de una propiedad antes de enviar sus fotos con send_property_photos.",
    input_schema: {
      type: "object",
      properties: {
        propertyType: { type: "string", enum: PROPERTY_TYPES, description: "Tipo de propiedad" },
        listingType: { type: "string", enum: LISTING_TYPES.filter((t) => t !== "VENTA_ALQUILER"), description: "VENTA o ALQUILER" },
        city: { type: "string", description: "Ciudad (ej. Santo Domingo)" },
        sector: { type: "string", description: "Sector o zona (ej. Naco, Piantini, Bávaro)" },
        minBedrooms: { type: "number", description: "Habitaciones mínimas" },
        maxPriceUSD: { type: "number", description: "Precio máximo en USD" },
        maxPriceDOP: { type: "number", description: "Precio máximo en RD$" },
      },
      required: [],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as {
      propertyType?: PropertyType; listingType?: ListingType; city?: string; sector?: string;
      minBedrooms?: number; maxPriceUSD?: number; maxPriceDOP?: number;
    };

    const properties = await prisma.property.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        status: "DISPONIBLE",
        ...(input.propertyType && PROPERTY_TYPES.includes(input.propertyType) ? { propertyType: input.propertyType } : {}),
        ...(input.listingType && LISTING_TYPES.includes(input.listingType)
          ? { listingType: { in: [input.listingType, "VENTA_ALQUILER" as const] } }
          : {}),
        ...(input.city ? { city: { contains: input.city, mode: "insensitive" as const } } : {}),
        ...(input.sector ? { sector: { contains: input.sector, mode: "insensitive" as const } } : {}),
        ...(input.minBedrooms ? { bedrooms: { gte: input.minBedrooms } } : {}),
        ...(input.maxPriceUSD ? { priceUSD: { lte: input.maxPriceUSD } } : {}),
        ...(input.maxPriceDOP ? { priceDOP: { lte: input.maxPriceDOP } } : {}),
      },
      include: { photos: { select: { id: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (!properties.length) return "No hay propiedades disponibles que coincidan con esos criterios.";

    return properties
      .map((p) => {
        const price = [p.priceUSD ? `USD $${p.priceUSD.toLocaleString()}` : null, p.priceDOP ? `RD$${p.priceDOP.toLocaleString()}` : null]
          .filter(Boolean)
          .join(" / ");
        const rentSuffix = p.listingType === "ALQUILER" && price ? " al mes" : "";
        const specs = propertySpecs(p);
        const where = propertyLocation(p);
        return (
          `- [id:${p.id}] ${p.title} (${PROPERTY_TYPE_LABELS[p.propertyType]}, ${LISTING_TYPE_LABELS[p.listingType]})` +
          `${where ? `, ${where}` : ""}${specs ? `, ${specs}` : ""}${price ? `, ${price}${rentSuffix}` : ""}` +
          `${p.photos.length ? " (tiene fotos)" : " (sin fotos)"}`
        );
      })
      .join("\n");
  },
};
