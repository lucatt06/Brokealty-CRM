import type { Vehicle, VehiclePhoto } from "@prisma/client";

/**
 * Allowlist explícita (Documento 7, sección 2.3 y 16.7): un endpoint público arma su
 * propio objeto campo por campo en vez de excluir lo interno de un spread — así, si el
 * modelo Vehicle gana un campo interno nuevo mañana, esta función simplemente no lo
 * conoce y no puede filtrarlo por accidente. Nunca agregar costDOP, sku, vin,
 * lotLocation ni priceHistory aquí.
 */
export function toPublicVehicle(vehicle: Vehicle & { photos: VehiclePhoto[] }, showPrices: boolean) {
  return {
    id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    trim: vehicle.trim,
    color: vehicle.color,
    colorHex: vehicle.colorHex,
    mileage: vehicle.mileage,
    transmission: vehicle.transmission,
    fuelType: vehicle.fuelType,
    bodyType: vehicle.bodyType,
    engineCC: vehicle.engineCC,
    doors: vehicle.doors,
    priceDOP: showPrices ? vehicle.priceDOP : null,
    priceUSD: showPrices ? vehicle.priceUSD : null,
    description: vehicle.description,
    features: vehicle.features,
    videoUrl: vehicle.videoUrl,
    photos: vehicle.photos
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ id: p.id, url: p.url, isPrimary: p.isPrimary })),
  };
}

export type PublicVehicle = ReturnType<typeof toPublicVehicle>;
