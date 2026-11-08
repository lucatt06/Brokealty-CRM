"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { runMatchInverso } from "@/lib/jobs/match-inverso";
import { isGoogleMapsHost, parseCoords } from "@/lib/maps/parse-coords";
import { readTextCapped, safeFetch } from "@/lib/net/safe-fetch";
import type { ListingType, PropertyStatus, PropertyType } from "@prisma/client";

export type PropertyInput = {
  sku?: string | null;
  status?: PropertyStatus;
  propertyType: PropertyType;
  listingType: ListingType;
  title: string;
  projectName?: string | null;
  province?: string | null;
  city?: string | null;
  sector?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  constructionM2?: number | null;
  landM2?: number | null;
  floorNumber?: number | null;
  yearBuilt?: number | null;
  furnished?: boolean;
  priceDOP?: number | null;
  priceUSD?: number | null;
  maintenanceDOP?: number | null;
  minimumPrice?: number | null;
  commissionPct?: number | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  capturedById?: string | null;
  videoUrl?: string | null;
  virtualTourUrl?: string | null;
  listedAt?: string | null;
  description?: string | null;
  features?: string[];
};

/** El workspace SIEMPRE sale de la sesión — nunca de un parámetro del cliente. */
async function requireWorkspaceId() {
  const ctx = await getActiveWorkspace();
  if (!ctx) throw new Error("Sesión no válida.");
  return ctx.workspace.id;
}

async function assertOwnsProperty(workspaceId: string, id: string) {
  const found = await prisma.property.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!found) throw new Error("Propiedad no encontrada.");
}

const clean = (v?: string | null) => v?.trim() || null;

function toData(d: PropertyInput) {
  const title = d.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  const lat = d.latitude ?? null;
  const lng = d.longitude ?? null;
  if ((lat == null) !== (lng == null)) throw new Error("Indica latitud y longitud, o ninguna de las dos.");
  if (lat != null && lng != null && !(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw new Error("Coordenadas fuera de rango.");
  return {
    sku: clean(d.sku),
    propertyType: d.propertyType,
    listingType: d.listingType,
    title,
    projectName: clean(d.projectName),
    province: clean(d.province),
    city: clean(d.city),
    sector: clean(d.sector),
    address: clean(d.address),
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    bedrooms: d.bedrooms ?? null,
    bathrooms: d.bathrooms ?? null,
    parkingSpaces: d.parkingSpaces ?? null,
    constructionM2: d.constructionM2 ?? null,
    landM2: d.landM2 ?? null,
    floorNumber: d.floorNumber ?? null,
    yearBuilt: d.yearBuilt ?? null,
    furnished: d.furnished ?? false,
    priceDOP: d.priceDOP ?? null,
    priceUSD: d.priceUSD ?? null,
    maintenanceDOP: d.maintenanceDOP ?? null,
    minimumPrice: d.minimumPrice ?? null,
    commissionPct: d.commissionPct ?? null,
    ownerName: clean(d.ownerName),
    ownerPhone: clean(d.ownerPhone),
    ownerEmail: clean(d.ownerEmail),
    capturedById: d.capturedById || null,
    videoUrl: clean(d.videoUrl),
    virtualTourUrl: clean(d.virtualTourUrl),
    description: clean(d.description),
    features: d.features ?? [],
  };
}

export async function createProperty(data: PropertyInput, tagIds: string[] = []) {
  const workspaceId = await requireWorkspaceId();
  const base = toData(data);

  const property = await prisma.property.create({
    data: {
      ...base,
      workspaceId,
      status: data.status ?? "DISPONIBLE",
      listedAt: data.listedAt ? new Date(data.listedAt) : new Date(),
      tags: tagIds.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
    },
  });

  if (base.priceDOP || base.priceUSD) {
    await prisma.propertyPriceHistory.create({
      data: { propertyId: property.id, priceDOP: base.priceDOP, priceUSD: base.priceUSD, note: "Precio inicial" },
    });
  }

  await runMatchInverso(property);

  revalidatePath("/inventario");
  return property;
}

export async function updateProperty(id: string, data: PropertyInput) {
  const workspaceId = await requireWorkspaceId();
  await assertOwnsProperty(workspaceId, id);
  const base = toData(data);

  const current = await prisma.property.findUnique({ where: { id }, select: { priceDOP: true, priceUSD: true } });

  await prisma.property.update({
    where: { id },
    data: {
      ...base,
      status: data.status,
      listedAt: data.listedAt ? new Date(data.listedAt) : undefined,
    },
  });

  const priceChanged = current && (current.priceDOP !== base.priceDOP || current.priceUSD !== base.priceUSD);
  if (priceChanged) {
    await prisma.propertyPriceHistory.create({
      data: { propertyId: id, priceDOP: base.priceDOP, priceUSD: base.priceUSD, note: "Precio actualizado" },
    });
  }

  revalidatePath("/inventario");
  revalidatePath("/negocios");
}

export async function updatePropertyStatus(id: string, status: PropertyStatus) {
  const workspaceId = await requireWorkspaceId();
  await assertOwnsProperty(workspaceId, id);
  await prisma.property.update({
    where: { id },
    data: {
      status,
      soldDate: status === "VENDIDO" || status === "ALQUILADO" ? new Date() : null,
    },
  });
  revalidatePath("/inventario");
  revalidatePath("/negocios");
}

export async function deleteProperty(id: string) {
  const workspaceId = await requireWorkspaceId();
  await assertOwnsProperty(workspaceId, id);
  await prisma.property.delete({ where: { id } });
  revalidatePath("/inventario");
}

export async function duplicateProperty(id: string) {
  const workspaceId = await requireWorkspaceId();
  const original = await prisma.property.findFirst({
    where: { id, workspaceId },
    include: { photos: true, tags: { select: { id: true } } },
  });
  if (!original) return null;

  const clone = await prisma.property.create({
    data: {
      workspaceId,
      sku: null,
      status: "DISPONIBLE",
      propertyType: original.propertyType,
      listingType: original.listingType,
      title: `${original.title} (copia)`,
      projectName: original.projectName,
      province: original.province,
      city: original.city,
      sector: original.sector,
      address: original.address,
      latitude: original.latitude,
      longitude: original.longitude,
      bedrooms: original.bedrooms,
      bathrooms: original.bathrooms,
      parkingSpaces: original.parkingSpaces,
      constructionM2: original.constructionM2,
      landM2: original.landM2,
      floorNumber: original.floorNumber,
      yearBuilt: original.yearBuilt,
      furnished: original.furnished,
      priceDOP: original.priceDOP,
      priceUSD: original.priceUSD,
      maintenanceDOP: original.maintenanceDOP,
      minimumPrice: original.minimumPrice,
      commissionPct: original.commissionPct,
      ownerName: original.ownerName,
      ownerPhone: original.ownerPhone,
      ownerEmail: original.ownerEmail,
      capturedById: original.capturedById,
      videoUrl: original.videoUrl,
      virtualTourUrl: original.virtualTourUrl,
      listedAt: new Date(),
      description: original.description,
      features: original.features,
      tags: original.tags.length ? { connect: original.tags.map((t) => ({ id: t.id })) } : undefined,
      photos: { create: original.photos.map((p) => ({ url: p.url, isPrimary: p.isPrimary, order: p.order })) },
    },
  });

  await runMatchInverso(clone);

  revalidatePath("/inventario");
  return clone;
}

// ── Fotos ──────────────────────────────────────────────
export async function addPropertyPhoto(propertyId: string, url: string) {
  const workspaceId = await requireWorkspaceId();
  await assertOwnsProperty(workspaceId, propertyId);
  const count = await prisma.propertyPhoto.count({ where: { propertyId } });
  await prisma.propertyPhoto.create({ data: { propertyId, url, isPrimary: count === 0, order: count } });
  revalidatePath("/inventario");
}

async function assertOwnsPhoto(workspaceId: string, photoId: string) {
  const photo = await prisma.propertyPhoto.findFirst({
    where: { id: photoId, property: { workspaceId } },
    select: { id: true },
  });
  if (!photo) throw new Error("Foto no encontrada.");
}

export async function removePropertyPhoto(photoId: string) {
  const workspaceId = await requireWorkspaceId();
  await assertOwnsPhoto(workspaceId, photoId);
  const photo = await prisma.propertyPhoto.delete({ where: { id: photoId } });
  if (photo.isPrimary) {
    const next = await prisma.propertyPhoto.findFirst({ where: { propertyId: photo.propertyId }, orderBy: { order: "asc" } });
    if (next) await prisma.propertyPhoto.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  revalidatePath("/inventario");
}

export async function setPrimaryPhoto(propertyId: string, photoId: string) {
  const workspaceId = await requireWorkspaceId();
  await assertOwnsProperty(workspaceId, propertyId);
  await assertOwnsPhoto(workspaceId, photoId);
  await prisma.$transaction([
    prisma.propertyPhoto.updateMany({ where: { propertyId }, data: { isPrimary: false } }),
    prisma.propertyPhoto.update({ where: { id: photoId }, data: { isPrimary: true } }),
  ]);
  revalidatePath("/inventario");
}

export async function reorderPropertyPhotos(orderedIds: string[]) {
  const workspaceId = await requireWorkspaceId();
  const owned = await prisma.propertyPhoto.count({ where: { id: { in: orderedIds }, property: { workspaceId } } });
  if (owned !== orderedIds.length) throw new Error("Foto no encontrada.");
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.propertyPhoto.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath("/inventario");
}

// ── Tags ───────────────────────────────────────────────
export async function setPropertyTags(propertyId: string, tagIds: string[]) {
  const workspaceId = await requireWorkspaceId();
  await assertOwnsProperty(workspaceId, propertyId);
  const validTags = await prisma.tag.findMany({ where: { id: { in: tagIds }, workspaceId }, select: { id: true } });
  await prisma.property.update({
    where: { id: propertyId },
    data: { tags: { set: validTags.map((t) => ({ id: t.id })) } },
  });
  revalidatePath("/inventario");
}

export async function createTag(name: string, color = "#2563EB") {
  const workspaceId = await requireWorkspaceId();
  const tag = await prisma.tag.upsert({
    where: { workspaceId_name: { workspaceId, name } },
    update: {},
    create: { workspaceId, name, color },
  });
  revalidatePath("/inventario");
  return tag;
}

// ── Coordenadas desde un enlace de Google Maps ─────────────────────────
type CoordsResult = { ok: true; latitude: number; longitude: number } | { ok: false; error: string };

/**
 * Lee la coordenada de un enlace pegado por el usuario. Los enlaces cortos (maps.app.goo.gl) se
 * siguen en el servidor, pero SOLO hacia hosts de Google y con la protección SSRF de safeFetch;
 * esta acción no sirve para consultar URLs arbitrarias.
 */
export async function resolveMapsLink(input: string): Promise<CoordsResult> {
  await requireWorkspaceId();
  const text = input.trim();
  if (!text || text.length > 2000) return { ok: false, error: "Pega un enlace de Google Maps o las coordenadas (18.4861, -69.9312)." };

  const direct = parseCoords(text);
  if (direct) return { ok: true, ...direct };

  if (!isGoogleMapsHost(text)) return { ok: false, error: "Solo se aceptan enlaces de Google Maps o coordenadas." };
  try {
    const res = await safeFetch(text, { timeoutMs: 6000 });
    const fromUrl = parseCoords(res.url);
    if (fromUrl) return { ok: true, ...fromUrl };
    // Algunos enlaces devuelven la coordenada dentro del HTML (og:image / meta).
    const html = await readTextCapped(res, 300_000);
    const fromHtml = parseCoords(html.match(/[?&]center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/)?.slice(1, 3).join(",") ?? "");
    if (fromHtml) return { ok: true, ...fromHtml };
  } catch (e) {
    console.error("[maps] no se pudo resolver el enlace:", e instanceof Error ? e.message : e);
  }
  return { ok: false, error: "No pude leer la ubicación de ese enlace. Abre el sitio en Google Maps, copia las coordenadas y pégalas aquí." };
}
