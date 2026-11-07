import { prisma } from "@/lib/prisma";
import type { AgentToolDefinition } from "../types";

export const searchInventoryTool: AgentToolDefinition = {
  key: "search_inventory",
  anthropicSchema: {
    name: "search_inventory",
    description:
      "Busca vehículos disponibles en el inventario del dealer, filtrando por marca, modelo, año o precio máximo. " +
      "Úsala para responder preguntas sobre qué vehículos hay disponibles, y para obtener el id de un vehículo antes de enviar sus fotos con send_vehicle_photos.",
    input_schema: {
      type: "object",
      properties: {
        make: { type: "string", description: "Marca del vehículo (ej. Toyota)" },
        model: { type: "string", description: "Modelo del vehículo (ej. Corolla)" },
        minYear: { type: "number", description: "Año mínimo" },
        maxYear: { type: "number", description: "Año máximo" },
        maxPriceUSD: { type: "number", description: "Precio máximo en USD" },
      },
      required: [],
    },
  },
  execute: async (rawInput, ctx) => {
    const input = rawInput as { make?: string; model?: string; minYear?: number; maxYear?: number; maxPriceUSD?: number };

    const vehicles = await prisma.vehicle.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        status: "DISPONIBLE",
        ...(input.make ? { make: { contains: input.make, mode: "insensitive" } } : {}),
        ...(input.model ? { model: { contains: input.model, mode: "insensitive" } } : {}),
        ...(input.minYear || input.maxYear
          ? { year: { ...(input.minYear ? { gte: input.minYear } : {}), ...(input.maxYear ? { lte: input.maxYear } : {}) } }
          : {}),
        ...(input.maxPriceUSD ? { priceUSD: { lte: input.maxPriceUSD } } : {}),
      },
      include: { photos: { select: { id: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (!vehicles.length) return "No hay vehículos disponibles que coincidan con esos criterios.";

    return vehicles
      .map((v) => {
        const price = [v.priceUSD ? `USD $${v.priceUSD.toLocaleString()}` : null, v.priceDOP ? `RD$${v.priceDOP.toLocaleString()}` : null]
          .filter(Boolean)
          .join(" / ");
        return (
          `- [id:${v.id}] ${v.make} ${v.model} ${v.year}${v.trim ? ` ${v.trim}` : ""}, color ${v.color ?? "N/D"}, ${v.mileage ?? 0} km` +
          `${price ? `, ${price}` : ""}${v.photos.length ? " (tiene fotos)" : " (sin fotos)"}`
        );
      })
      .join("\n");
  },
};
