"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { renderConducePdf, type ConducePdfData } from "@/lib/pdf/conduce-pdf";
import { uploadConducePdf } from "@/lib/storage/upload-conduce-pdf";
import { CONDUCE_REASON_LABELS } from "@/lib/conduces/labels";
import type { Conduce, ConduceReason } from "@prisma/client";

async function requireAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx || (ctx.role !== "ADMIN_DEALER" && !ctx.isSuperAdmin)) {
    throw new Error("Solo un Admin Dealer puede autorizar movimientos de vehículos.");
  }
  return ctx;
}

/**
 * Genera y sube el PDF del conduce después de que el registro ya está confirmado en BD
 * (efecto externo fuera de la transacción) y le adjunta la URL resultante. Un fallo aquí
 * no debe deshacer el conduce ya creado — solo queda sin documentUrl.
 */
async function generateAndAttachPdf(conduce: Conduce, workspaceName: string, authorizedByName: string, vehicle: { make: string; model: string; year: number; vin: string | null }) {
  try {
    const pdfData: ConducePdfData = {
      id: conduce.id,
      type: conduce.type,
      reasonLabel: CONDUCE_REASON_LABELS[conduce.reason],
      reasonDetail: conduce.reasonDetail,
      workspaceName,
      vehicle,
      authorizedByName,
      driverName: conduce.driverName,
      driverDocument: conduce.driverDocument,
      originLocation: conduce.originLocation,
      destinationLocation: conduce.destinationLocation,
      mileageAtMovement: conduce.mileageAtMovement,
      observations: conduce.observations,
      expectedReturnAt: conduce.expectedReturnAt,
      createdAt: conduce.createdAt,
    };
    const buffer = await renderConducePdf(pdfData);
    const documentUrl = await uploadConducePdf(buffer, conduce.id);
    await prisma.conduce.update({ where: { id: conduce.id }, data: { documentUrl } });
  } catch (err) {
    console.error("Fallo generando/subiendo el PDF del conduce:", err);
  }
}

type CreateSalidaInput = {
  reason: ConduceReason;
  reasonDetail?: string;
  driverName?: string;
  driverDocument?: string;
  destinationLocation?: string;
  mileageAtMovement?: number;
  expectedReturnAt?: string; // ISO
  leadId?: string;
};

export async function createConduceSalida(vehicleId: string, data: CreateSalidaInput) {
  const ctx = await requireAdmin();

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { workspaceId: true, make: true, model: true, year: true, vin: true },
  });
  if (!vehicle) throw new Error("Vehículo no encontrado.");

  const vehiclePart = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;

  const [conduce] = await prisma.$transaction([
    prisma.conduce.create({
      data: {
        workspaceId: vehicle.workspaceId,
        vehicleId,
        type: "SALIDA",
        reason: data.reason,
        reasonDetail: data.reasonDetail?.trim() || null,
        authorizedById: ctx.user.id,
        driverName: data.driverName?.trim() || null,
        driverDocument: data.driverDocument?.trim() || null,
        destinationLocation: data.destinationLocation?.trim() || null,
        mileageAtMovement: data.mileageAtMovement ?? null,
        expectedReturnAt: data.expectedReturnAt ? new Date(data.expectedReturnAt) : null,
        leadId: data.leadId || null,
        status: "ABIERTO",
      },
    }),
    prisma.activity.create({
      data: {
        workspaceId: vehicle.workspaceId,
        vehicleId,
        userId: ctx.user.id,
        type: "CONDUCE_SALIDA",
        description: `Salida registrada (${CONDUCE_REASON_LABELS[data.reason]}) · ${vehiclePart}`,
      },
    }),
  ]);

  await generateAndAttachPdf(conduce, ctx.workspace.name, ctx.user.name, vehicle);

  revalidatePath(`/inventario/${vehicleId}`);
  revalidatePath("/inventario");
}

type CreateEntradaInput = {
  returnConduceId: string;
  mileageAtMovement?: number;
  observations?: string;
};

export async function createConduceEntrada(vehicleId: string, data: CreateEntradaInput) {
  const ctx = await requireAdmin();

  const [salida, vehicle] = await Promise.all([
    prisma.conduce.findUnique({
      where: { id: data.returnConduceId },
      select: { id: true, workspaceId: true, vehicleId: true, type: true, status: true, reason: true },
    }),
    prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { make: true, model: true, year: true, vin: true } }),
  ]);
  if (!salida || salida.vehicleId !== vehicleId || salida.type !== "SALIDA" || salida.status !== "ABIERTO") {
    throw new Error("La salida indicada no está abierta para este vehículo.");
  }
  if (!vehicle) throw new Error("Vehículo no encontrado.");

  const vehiclePart = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;
  const entryReason: ConduceReason = salida.reason === "PRUEBA_MANEJO" ? "DEVOLUCION_PRUEBA" : salida.reason;

  const entrada = await prisma.$transaction(async (tx) => {
    const created = await tx.conduce.create({
      data: {
        workspaceId: salida.workspaceId,
        vehicleId,
        type: "ENTRADA",
        reason: entryReason,
        authorizedById: ctx.user.id,
        mileageAtMovement: data.mileageAtMovement ?? null,
        observations: data.observations?.trim() || null,
        status: "CERRADO",
      },
    });
    await tx.conduce.update({
      where: { id: salida.id },
      data: { status: "CERRADO", actualReturnAt: new Date(), returnConduceId: created.id },
    });
    await tx.activity.create({
      data: {
        workspaceId: salida.workspaceId,
        vehicleId,
        userId: ctx.user.id,
        type: "CONDUCE_ENTRADA",
        description: `Entrada registrada (${CONDUCE_REASON_LABELS[entryReason]}) · ${vehiclePart}`,
      },
    });
    return created;
  });

  await generateAndAttachPdf(entrada, ctx.workspace.name, ctx.user.name, vehicle);

  revalidatePath(`/inventario/${vehicleId}`);
  revalidatePath("/inventario");
}
