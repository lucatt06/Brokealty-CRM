"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import type { IdDocumentType, RiskLevel } from "@prisma/client";

async function requireAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx || (ctx.role !== "ADMIN_DEALER" && !ctx.isSuperAdmin)) {
    throw new Error("Solo un Admin Dealer puede aprobar o rechazar una Debida Diligencia.");
  }
  return ctx;
}

/**
 * Umbrales configurables por workspace (Documento 7, sección 3.4) — sin config,
 * esos factores simplemente no aplican, no se inventa un default arbitrario.
 * isPep siempre fuerza ALTO — no es un umbral, es inherente a lo que significa PEP.
 */
async function calculateRiskLevel(workspaceId: string, input: { isPep: boolean; operationAmount?: number | null; isCashPayment?: boolean }): Promise<RiskLevel> {
  if (input.isPep) return "ALTO";

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ddcHighRiskAmount: true, ddcCashPaymentThreshold: true },
  });

  let factors = 0;
  if (workspace?.ddcHighRiskAmount != null && input.operationAmount != null && input.operationAmount > workspace.ddcHighRiskAmount) factors++;
  if (workspace?.ddcCashPaymentThreshold != null && input.isCashPayment && input.operationAmount != null && input.operationAmount > workspace.ddcCashPaymentThreshold) factors++;

  if (factors >= 2) return "ALTO";
  if (factors === 1) return "MEDIO";
  return "BAJO";
}

type DdcInput = {
  idDocumentType: IdDocumentType;
  idDocumentNumber: string;
  idDocumentUrl?: string;
  fullLegalName: string;
  nationality?: string;
  addressLine?: string;
  addressProofUrl?: string;
  occupation?: string;
  incomeSource?: string;
  isPep: boolean;
  pepDetail?: string;
  operationAmount?: number | null;
  isCashPayment?: boolean;
};

export async function createOrUpdateDdc(ddcId: string | null, leadId: string, workspaceId: string, data: DdcInput) {
  const riskLevel = await calculateRiskLevel(workspaceId, data);
  const isHighRisk = riskLevel === "ALTO";

  const payload = {
    idDocumentType: data.idDocumentType,
    idDocumentNumber: data.idDocumentNumber.trim(),
    idDocumentUrl: data.idDocumentUrl?.trim() || null,
    fullLegalName: data.fullLegalName.trim(),
    nationality: data.nationality?.trim() || null,
    addressLine: data.addressLine?.trim() || null,
    addressProofUrl: data.addressProofUrl?.trim() || null,
    occupation: data.occupation?.trim() || null,
    incomeSource: data.incomeSource?.trim() || null,
    isPep: data.isPep,
    pepDetail: data.pepDetail?.trim() || null,
    riskLevel,
    // Regla dura (Documento 7, sección 3.2): riesgo ALTO fuerza revisión manual — nunca se auto-aprueba.
    status: isHighRisk ? ("EN_REVISION" as const) : ("PENDIENTE" as const),
  };

  if (ddcId) {
    await prisma.customerDueDiligence.update({ where: { id: ddcId }, data: payload });
  } else {
    await prisma.customerDueDiligence.create({ data: { workspaceId, leadId, ...payload } });
    await prisma.activity.create({
      data: { workspaceId, leadId, type: "NOTE_ADDED", description: "Debida Diligencia del Cliente creada" },
    });
  }
  revalidatePath(`/leads/${leadId}`);
}

export async function approveDdc(ddcId: string, notes?: string) {
  const ctx = await requireAdmin();
  const ddc = await prisma.customerDueDiligence.update({
    where: { id: ddcId },
    data: { status: "APROBADO", reviewedById: ctx.user.id, reviewedAt: new Date(), reviewNotes: notes?.trim() || null, rejectionReason: null },
    select: { workspaceId: true, leadId: true },
  });
  await prisma.activity.create({
    data: { workspaceId: ddc.workspaceId, leadId: ddc.leadId, type: "DDC_APROBADO", description: "Debida Diligencia aprobada" },
  });
  revalidatePath(`/leads/${ddc.leadId}`);
}

export async function rejectDdc(ddcId: string, reason: string) {
  if (!reason.trim()) throw new Error("Rechazar una Debida Diligencia requiere un motivo.");
  const ctx = await requireAdmin();
  const ddc = await prisma.customerDueDiligence.update({
    where: { id: ddcId },
    data: { status: "RECHAZADO", reviewedById: ctx.user.id, reviewedAt: new Date(), rejectionReason: reason.trim() },
    select: { workspaceId: true, leadId: true },
  });
  await prisma.activity.create({
    data: { workspaceId: ddc.workspaceId, leadId: ddc.leadId, type: "DDC_RECHAZADO", description: `Debida Diligencia rechazada — ${reason.trim()}` },
  });
  revalidatePath(`/leads/${ddc.leadId}`);
}
