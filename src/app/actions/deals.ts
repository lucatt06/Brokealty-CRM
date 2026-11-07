"use server";

import { AuthError, assertMember, assertOwns, assertWorkspace, requireCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fireAutomationTrigger } from "@/lib/jobs/run-automations";
import { createSalesOrderFromDeal } from "@/app/actions/sales-orders";

export async function updateDealStage(dealId: string, stageId: string) {
  const ctx = await requireCtx();
  await assertOwns("deal", dealId, ctx.workspace.id);
  await assertOwns("stage", stageId, ctx.workspace.id);
  if (!(await prisma.deal.count({ where: { id: dealId, pipeline: { stages: { some: { id: stageId } } } } }))) throw new AuthError("La etapa no pertenece al pipeline del negocio.");
  const [deal, newStage] = await Promise.all([
    prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        workspaceId: true,
        leadId: true,
        stage: { select: { name: true } },
        property: { select: { title: true } },
      },
    }),
    prisma.pipelineStage.findUnique({
      where: { id: stageId },
      select: { name: true },
    }),
  ]);

  const oldName = deal?.stage?.name ?? "Sin etapa";
  const newName = newStage?.name ?? "—";
  const propertyPart = deal?.property
    ? ` · ${deal.property.title}`
    : "";

  await prisma.$transaction([
    prisma.deal.update({ where: { id: dealId }, data: { stageId } }),
    ...(deal?.workspaceId
      ? [prisma.activity.create({
          data: {
            workspaceId: deal.workspaceId,
            leadId: deal.leadId,
            type: "STAGE_CHANGED",
            description: `Etapa cambiada: ${oldName} → ${newName}${propertyPart}`,
          },
        })]
      : []),
  ]);

  // El pipeline movement real de este CRM es Deal.stageId (Lead.stage se fija una
  // sola vez al crear el lead y nunca se vuelve a tocar) — LEAD_STAGE_CHANGED se
  // cablea aquí, no contra Lead.stage.
  if (deal?.workspaceId && newStage) {
    await fireAutomationTrigger(deal.workspaceId, "LEAD_STAGE_CHANGED", {
      leadId: deal.leadId,
      triggerContext: { toStage: newStage.name },
    });
  }

  revalidatePath("/conversaciones");
}

export async function updateDealStatus(dealId: string, status: "OPEN" | "WON" | "LOST") {
  const ctx = await requireCtx();
  await assertOwns("deal", dealId, ctx.workspace.id);
  if (status === "WON") throw new AuthError("Un negocio se gana completando su Orden de Venta.");
  await prisma.deal.update({
    where: { id: dealId },
    data: { status, closedAt: status !== "OPEN" ? new Date() : null },
  });
  revalidatePath("/conversaciones");
  revalidatePath("/negocios");
}

export async function createDeal(
  workspaceId: string,
  pipelineId: string,
  leadId: string,
  stageId: string,
  value: number | null,
  currency: string,
  propertyId?: string,
) {
  const ctx = await requireCtx();
  assertWorkspace(ctx, workspaceId);
  await assertOwns("pipeline", pipelineId, workspaceId);
  await assertOwns("lead", leadId, workspaceId);
  await assertOwns("stage", stageId, workspaceId);
  await assertOwns("property", propertyId, workspaceId);
  if (currency !== "DOP" && currency !== "USD") throw new AuthError("Moneda no válida.");
  if (value != null && !(Number.isFinite(value) && value >= 0)) throw new AuthError("Valor no válido.");
  await prisma.deal.create({
    data: {
      workspaceId, pipelineId, leadId, stageId,
      value, currency,
      propertyId: propertyId || null,
    },
  });
  revalidatePath("/negocios");
}

export async function updateDealValue(dealId: string, value: number | null, currency: string) {
  const ctx = await requireCtx();
  await assertOwns("deal", dealId, ctx.workspace.id);
  if (currency !== "DOP" && currency !== "USD") throw new AuthError("Moneda no válida.");
  if (value != null && !(Number.isFinite(value) && value >= 0)) throw new AuthError("Valor no válido.");
  await prisma.deal.update({ where: { id: dealId }, data: { value, currency } });
  revalidatePath("/negocios");
}

export async function updateDealAssignee(dealId: string, userId: string | null) {
  const ctx = await requireCtx();
  await assertOwns("deal", dealId, ctx.workspace.id);
  await assertMember(userId, ctx.workspace.id);
  await prisma.deal.update({ where: { id: dealId }, data: { assignedToId: userId } });
  revalidatePath("/negocios");
}

export async function updateDealExpectedClose(dealId: string, expectedCloseAt: string | null) {
  const ctx = await requireCtx();
  await assertOwns("deal", dealId, ctx.workspace.id);
  await prisma.deal.update({
    where: { id: dealId },
    data: { expectedCloseAt: expectedCloseAt ? new Date(expectedCloseAt) : null },
  });
  revalidatePath("/negocios");
}

/**
 * "WON" ya no cierra la venta al instante (Fase 2B, Documento 7 sección 6.1) — crea
 * o reutiliza la Orden de Venta formal del deal y devuelve su id para que la UI
 * navegue ahí. La venta solo se completa de verdad (cascada real: propiedad vendido,
 * comisión, etc.) cuando esa orden se completa — ver completeSalesOrder() en
 * src/app/actions/sales-orders.ts. "LOST" no cambia.
 */
export async function closeDeal(dealId: string, status: "WON" | "LOST", lostReason?: string): Promise<{ salesOrderId?: string }> {
  if (status === "WON") {
  const ctx = await requireCtx();
  await assertOwns("deal", dealId, ctx.workspace.id);
    return createSalesOrderFromDeal(dealId);
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      workspaceId: true, leadId: true, property: { select: { title: true } },
    },
  });
  const propertyPart = deal?.property ? ` · ${deal.property.title}` : "";

  await prisma.$transaction([
    prisma.deal.update({ where: { id: dealId }, data: { status, closedAt: new Date(), lostReason: lostReason ?? null } }),
    ...(deal?.workspaceId
      ? [prisma.activity.create({
          data: {
            workspaceId: deal.workspaceId, leadId: deal.leadId, type: "DEAL_LOST",
            description: `Negocio perdido${propertyPart}${lostReason ? ` — ${lostReason}` : ""}`,
          },
        })]
      : []),
  ]);

  revalidatePath("/negocios");
  revalidatePath("/conversaciones");
  revalidatePath("/leads");
  return {};
}
