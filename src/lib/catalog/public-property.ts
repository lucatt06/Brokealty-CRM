import type { Property, PropertyPhoto } from "@prisma/client";

/**
 * Allowlist explícita: un endpoint público arma su propio objeto campo por campo en vez
 * de excluir lo interno de un spread — así, si el modelo Property gana un campo interno
 * nuevo mañana, esta función no lo conoce y no puede filtrarlo por accidente.
 * Nunca agregar aquí: minimumPrice, commissionPct, owner*, capturedById, sku, latitude/
 * longitude exactas, ni priceHistory.
 */
export function toPublicProperty(property: Property & { photos: PropertyPhoto[] }, showPrices: boolean) {
  return {
    id: property.id,
    title: property.title,
    propertyType: property.propertyType,
    listingType: property.listingType,
    projectName: property.projectName,
    city: property.city,
    sector: property.sector,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parkingSpaces: property.parkingSpaces,
    constructionM2: property.constructionM2,
    landM2: property.landM2,
    floorNumber: property.floorNumber,
    yearBuilt: property.yearBuilt,
    furnished: property.furnished,
    priceDOP: showPrices ? property.priceDOP : null,
    priceUSD: showPrices ? property.priceUSD : null,
    maintenanceDOP: showPrices ? property.maintenanceDOP : null,
    description: property.description,
    features: property.features,
    videoUrl: property.videoUrl,
    virtualTourUrl: property.virtualTourUrl,
    photos: property.photos
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ id: p.id, url: p.url, isPrimary: p.isPrimary })),
  };
}

export type PublicProperty = ReturnType<typeof toPublicProperty>;
