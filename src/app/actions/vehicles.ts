"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { runMatchInverso } from "@/lib/jobs/match-inverso";

type VehicleStatus = "DISPONIBLE" | "RESERVADO" | "VENDIDO" | "EN_PREPARACION" | "FUERA_DE_INVENTARIO";
type Transmission = "AUTOMATICO" | "MANUAL" | "CVT" | "SEMI_AUTO";
type FuelType = "GASOLINA" | "DIESEL" | "HIBRIDO" | "ELECTRICO" | "GAS";
type BodyType = "SEDAN" | "SUV" | "PICKUP" | "HATCHBACK" | "COUPE" | "VAN" | "MINIVAN" | "CONVERTIBLE" | "WAGON";

type VehicleInput = {
  sku?: string | null;
  status?: VehicleStatus;
  make: string;
  model: string;
  year: number;
  trim?: string | null;
  color?: string | null;
  colorHex?: string | null;
  vin?: string | null;
  mileage?: number | null;
  transmission?: Transmission;
  fuelType?: FuelType;
  bodyType?: BodyType | null;
  engineCC?: number | null;
  doors?: number | null;
  priceDOP?: number | null;
  priceUSD?: number | null;
  costDOP?: number | null;
  videoUrl?: string | null;
  lotLocation?: string | null;
  arrivalDate?: string | null;
  description?: string | null;
  features?: string[];
};

function normalize(data: VehicleInput) {
  return {
    ...data,
    sku: data.sku?.trim() || null,
    vin: data.vin?.trim() || null,
  };
}

export async function createVehicle(workspaceId: string, data: VehicleInput, tagIds: string[] = []) {
  const n = normalize(data);
  const vehicle = await prisma.vehicle.create({
    data: {
      workspaceId,
      sku: n.sku,
      status: n.status ?? "DISPONIBLE",
      make: n.make,
      model: n.model,
      year: n.year,
      trim: n.trim || null,
      color: n.color || null,
      colorHex: n.colorHex || null,
      vin: n.vin,
      mileage: n.mileage ?? 0,
      transmission: n.transmission ?? "AUTOMATICO",
      fuelType: n.fuelType ?? "GASOLINA",
      bodyType: n.bodyType || null,
      engineCC: n.engineCC ?? null,
      doors: n.doors ?? 4,
      priceDOP: n.priceDOP ?? null,
      priceUSD: n.priceUSD ?? null,
      costDOP: n.costDOP ?? null,
      videoUrl: n.videoUrl || null,
      lotLocation: n.lotLocation || null,
      arrivalDate: n.arrivalDate ? new Date(n.arrivalDate) : new Date(),
      description: n.description || null,
      features: n.features ?? [],
      tags: tagIds.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
    },
  });

  if (n.priceDOP || n.priceUSD) {
    await prisma.vehiclePriceHistory.create({
      data: {
        vehicleId: vehicle.id,
        priceDOP: n.priceDOP ?? null,
        priceUSD: n.priceUSD ?? null,
        note: "Precio inicial",
      },
    });
  }

  await runMatchInverso(vehicle);

  revalidatePath("/inventario");
  return vehicle;
}

export async function updateVehicle(id: string, data: VehicleInput) {
  const n = normalize(data);
  const current = await prisma.vehicle.findUnique({
    where: { id },
    select: { priceDOP: true, priceUSD: true },
  });

  await prisma.vehicle.update({
    where: { id },
    data: {
      sku: n.sku,
      status: n.status,
      make: n.make,
      model: n.model,
      year: n.year,
      trim: n.trim || null,
      color: n.color || null,
      colorHex: n.colorHex || null,
      vin: n.vin,
      mileage: n.mileage ?? 0,
      transmission: n.transmission ?? "AUTOMATICO",
      fuelType: n.fuelType ?? "GASOLINA",
      bodyType: n.bodyType || null,
      engineCC: n.engineCC ?? null,
      doors: n.doors ?? 4,
      priceDOP: n.priceDOP ?? null,
      priceUSD: n.priceUSD ?? null,
      costDOP: n.costDOP ?? null,
      videoUrl: n.videoUrl || null,
      lotLocation: n.lotLocation || null,
      arrivalDate: n.arrivalDate ? new Date(n.arrivalDate) : undefined,
      description: n.description || null,
      features: n.features ?? [],
    },
  });

  const priceChanged =
    current && (current.priceDOP !== (n.priceDOP ?? null) || current.priceUSD !== (n.priceUSD ?? null));

  if (priceChanged) {
    await prisma.vehiclePriceHistory.create({
      data: {
        vehicleId: id,
        priceDOP: n.priceDOP ?? null,
        priceUSD: n.priceUSD ?? null,
        note: "Precio actualizado",
      },
    });
  }

  revalidatePath("/inventario");
  revalidatePath("/negocios");
}

export async function updateVehicleStatus(id: string, status: VehicleStatus) {
  await prisma.vehicle.update({
    where: { id },
    data: {
      status,
      soldDate: status === "VENDIDO" ? new Date() : null,
    },
  });
  revalidatePath("/inventario");
  revalidatePath("/negocios");
}

export async function deleteVehicle(id: string) {
  await prisma.vehicle.delete({ where: { id } });
  revalidatePath("/inventario");
}

export async function duplicateVehicle(id: string) {
  const original = await prisma.vehicle.findUnique({
    where: { id },
    include: { photos: true, tags: { select: { id: true } } },
  });
  if (!original) return null;

  const clone = await prisma.vehicle.create({
    data: {
      workspaceId: original.workspaceId,
      sku: null,
      status: "DISPONIBLE",
      make: original.make,
      model: original.model,
      year: original.year,
      trim: original.trim,
      color: original.color,
      colorHex: original.colorHex,
      vin: null,
      mileage: original.mileage,
      transmission: original.transmission,
      fuelType: original.fuelType,
      bodyType: original.bodyType,
      engineCC: original.engineCC,
      doors: original.doors,
      priceDOP: original.priceDOP,
      priceUSD: original.priceUSD,
      costDOP: original.costDOP,
      videoUrl: original.videoUrl,
      lotLocation: original.lotLocation,
      arrivalDate: new Date(),
      description: original.description,
      features: original.features,
      tags: original.tags.length ? { connect: original.tags.map((t) => ({ id: t.id })) } : undefined,
      photos: {
        create: original.photos.map((p) => ({ url: p.url, isPrimary: p.isPrimary, order: p.order })),
      },
    },
  });

  await runMatchInverso(clone);

  revalidatePath("/inventario");
  return clone;
}

// ── Fotos ──────────────────────────────────────────────
export async function addVehiclePhoto(vehicleId: string, url: string) {
  const count = await prisma.vehiclePhoto.count({ where: { vehicleId } });
  await prisma.vehiclePhoto.create({
    data: { vehicleId, url, isPrimary: count === 0, order: count },
  });
  revalidatePath("/inventario");
}

export async function removeVehiclePhoto(photoId: string) {
  const photo = await prisma.vehiclePhoto.delete({ where: { id: photoId } });
  if (photo.isPrimary) {
    const next = await prisma.vehiclePhoto.findFirst({
      where: { vehicleId: photo.vehicleId },
      orderBy: { order: "asc" },
    });
    if (next) await prisma.vehiclePhoto.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  revalidatePath("/inventario");
}

export async function setPrimaryPhoto(vehicleId: string, photoId: string) {
  await prisma.$transaction([
    prisma.vehiclePhoto.updateMany({ where: { vehicleId }, data: { isPrimary: false } }),
    prisma.vehiclePhoto.update({ where: { id: photoId }, data: { isPrimary: true } }),
  ]);
  revalidatePath("/inventario");
}

export async function reorderVehiclePhotos(orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.vehiclePhoto.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath("/inventario");
}

// ── Tags ───────────────────────────────────────────────
export async function setVehicleTags(vehicleId: string, tagIds: string[]) {
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { tags: { set: tagIds.map((id) => ({ id })) } },
  });
  revalidatePath("/inventario");
}

export async function createTag(workspaceId: string, name: string, color = "#2563EB") {
  const tag = await prisma.tag.upsert({
    where: { workspaceId_name: { workspaceId, name } },
    update: {},
    create: { workspaceId, name, color },
  });
  revalidatePath("/inventario");
  return tag;
}
