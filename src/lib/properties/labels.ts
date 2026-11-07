import type { AppointmentType, ListingType, PropertyStatus, PropertyType } from "@prisma/client";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTAMENTO: "Apartamento",
  CASA: "Casa",
  VILLA: "Villa",
  PENTHOUSE: "Penthouse",
  TERRENO: "Terreno",
  LOCAL_COMERCIAL: "Local comercial",
  OFICINA: "Oficina",
  NAVE_INDUSTRIAL: "Nave industrial",
  PROYECTO: "Proyecto",
  OTRO: "Otro",
};

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  VENTA: "Venta",
  ALQUILER: "Alquiler",
  VENTA_ALQUILER: "Venta o alquiler",
};

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  DISPONIBLE: "Disponible",
  RESERVADO: "Reservada",
  VENDIDO: "Vendida",
  ALQUILADO: "Alquilada",
  EN_PREPARACION: "En captación",
  FUERA_DE_CATALOGO: "Fuera de catálogo",
};

export const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[];
export const LISTING_TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];
export const PROPERTY_STATUSES = Object.keys(PROPERTY_STATUS_LABELS) as PropertyStatus[];

/** Amenidades sugeridas en el formulario (el usuario puede agregar otras). */
export const SUGGESTED_FEATURES = [
  "Piscina", "Gimnasio", "Seguridad 24h", "Ascensor", "Planta eléctrica", "Área social",
  "Terraza", "Balcón", "Cuarto de servicio", "Vista al mar", "Cerca de la playa", "Gas común",
  "Cisterna", "Inversor", "Walk-in closet", "Lobby",
] as const;

/** "Naco, Santo Domingo" — ubicación corta para tarjetas y mensajes. */
export function propertyLocation(p: { sector?: string | null; city?: string | null }) {
  return [p.sector, p.city].filter(Boolean).join(", ");
}

/** "3 hab · 2.5 baños · 180 m²" — resumen de características. */
export function propertySpecs(p: {
  bedrooms?: number | null; bathrooms?: number | null; constructionM2?: number | null; landM2?: number | null;
}) {
  const parts: string[] = [];
  if (p.bedrooms != null) parts.push(`${p.bedrooms} hab`);
  if (p.bathrooms != null) parts.push(`${p.bathrooms} baños`);
  const m2 = p.constructionM2 ?? p.landM2;
  if (m2 != null) parts.push(`${m2} m²`);
  return parts.join(" · ");
}

/** "Apartamento · Venta · Naco, Santo Domingo · 3+ hab" — lo que busca un lead. */
export function desiredSummary(l: {
  desiredPropertyType?: PropertyType | null; desiredListingType?: ListingType | null;
  desiredCity?: string | null; desiredSector?: string | null; desiredBedrooms?: number | null;
}) {
  return [
    l.desiredPropertyType ? PROPERTY_TYPE_LABELS[l.desiredPropertyType] : null,
    l.desiredListingType ? LISTING_TYPE_LABELS[l.desiredListingType] : null,
    propertyLocation({ sector: l.desiredSector, city: l.desiredCity }) || null,
    l.desiredBedrooms != null ? `${l.desiredBedrooms}+ hab` : null,
  ].filter(Boolean).join(" · ");
}

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  VISITA_PROPIEDAD: "Visita a propiedad",
  LLAMADA: "Llamada",
  VIDEO_LLAMADA: "Video llamada",
  FIRMA_CONTRATO: "Firma de contrato",
  ENTREGA_LLAVES: "Entrega de llaves",
  SEGUIMIENTO: "Seguimiento",
};
