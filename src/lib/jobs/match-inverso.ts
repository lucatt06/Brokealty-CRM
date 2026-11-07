import { prisma } from "@/lib/prisma";
import type { Property, Lead, Prisma } from "@prisma/client";
import { scheduleTask } from "./scheduled-tasks";

const TIMEOUT_MS = 30 * 60 * 1000;

function sameText(a: string, b: string | null | undefined): boolean {
  return !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** La propiedad ofrece el tipo de operación que el lead busca (VENTA_ALQUILER cubre ambas). */
function listingCompatible(wanted: Lead["desiredListingType"], offered: Property["listingType"]) {
  if (!wanted) return true;
  return offered === "VENTA_ALQUILER" || wanted === "VENTA_ALQUILER" || wanted === offered;
}

/**
 * Un lead matchea si TODOS los criterios "desired*" que tiene poblados coinciden con la
 * propiedad (tipo, operación, ciudad, sector, habitaciones mínimas) y, si indicó
 * presupuesto, el precio entra en él. Exige al menos un criterio: un lead sin criterios
 * no matchea con nada.
 */
function matchesProperty(lead: Lead, property: Property): boolean {
  let hasCriteria = false;

  if (lead.desiredPropertyType) {
    hasCriteria = true;
    if (lead.desiredPropertyType !== property.propertyType) return false;
  }
  if (lead.desiredListingType) {
    hasCriteria = true;
    if (!listingCompatible(lead.desiredListingType, property.listingType)) return false;
  }
  if (lead.desiredCity) {
    hasCriteria = true;
    if (!sameText(lead.desiredCity, property.city)) return false;
  }
  if (lead.desiredSector) {
    hasCriteria = true;
    if (!sameText(lead.desiredSector, property.sector)) return false;
  }
  if (lead.desiredBedrooms != null) {
    hasCriteria = true;
    if (property.bedrooms == null || property.bedrooms < lead.desiredBedrooms) return false;
  }
  if (!hasCriteria) return false;

  // Presupuesto (en la moneda del lead) — solo descarta si hay precio comparable y se pasa.
  const price = lead.budgetCurrency === "USD" ? property.priceUSD : property.priceDOP;
  if (lead.budgetMax != null && price != null && price > lead.budgetMax) return false;
  if (lead.budgetMin != null && price != null && price < lead.budgetMin) return false;

  return true;
}

/**
 * Cascada "Match Inverso" (CLAUDE.md): al llegar una propiedad nueva (o duplicada) al
 * catálogo, avisa a los leads que la estaban esperando. Por cada match: crea una Tarea
 * urgente para el agente asignado (o queda sin asignar, visible para todo el equipo, si
 * no hay ninguno), una Notification, y una Activity en el lead — todo en una transacción —
 * y programa un timeout de 30 min (ScheduledTask MATCH_INVERSO_TIMEOUT, handler en
 * run-scheduled-tasks.ts) que contacta al lead directamente si nadie completó la tarea.
 */
export async function runMatchInverso(property: Property) {
  const orFilters: Prisma.LeadWhereInput[] = [
    { desiredPropertyType: property.propertyType },
    ...(property.city ? [{ desiredCity: { equals: property.city, mode: "insensitive" as const } }] : []),
    ...(property.sector ? [{ desiredSector: { equals: property.sector, mode: "insensitive" as const } }] : []),
  ];

  const candidates = await prisma.lead.findMany({
    where: { workspaceId: property.workspaceId, isActive: true, OR: orFilters },
  });
  const matched = candidates.filter((lead) => matchesProperty(lead, property));
  if (!matched.length) return;

  const needsAdminFallback = matched.some((lead) => !lead.assignedTo);
  const admins = needsAdminFallback
    ? await prisma.workspaceUser.findMany({
        where: { workspaceId: property.workspaceId, role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
        select: { userId: true },
      })
    : [];

  const propertyLabel = property.title;

  const created = await prisma.$transaction(async (tx) => {
    const results: { leadId: string; taskId: string }[] = [];
    for (const lead of matched) {
      const task = await tx.task.create({
        data: {
          workspaceId: property.workspaceId,
          leadId: lead.id,
          assignedTo: lead.assignedTo,
          title: `Match Inverso: llegó ${propertyLabel} que le interesa a ${lead.firstName}`,
          description: "Contacta al lead antes de que se le avise automáticamente en 30 minutos.",
          priority: "ALTA",
        },
      });

      const targetUserIds = lead.assignedTo ? [lead.assignedTo] : admins.map((a) => a.userId);
      if (targetUserIds.length) {
        await tx.notification.createMany({
          data: targetUserIds.map((userId) => ({
            workspaceId: property.workspaceId,
            userId,
            leadId: lead.id,
            title: "Match Inverso",
            body: `Llegó ${propertyLabel}, justo lo que buscaba ${lead.firstName}.`,
            type: "MATCH_INVERSO",
          })),
        });
      }

      await tx.activity.create({
        data: {
          workspaceId: property.workspaceId,
          leadId: lead.id,
          type: "MATCH_INVERSO",
          description: `Match Inverso: llegó ${propertyLabel}, que coincide con lo que buscaba.`,
          metadata: { propertyId: property.id, taskId: task.id },
        },
      });

      results.push({ leadId: lead.id, taskId: task.id });
    }
    return results;
  });

  for (const { leadId, taskId } of created) {
    await scheduleTask({
      workspaceId: property.workspaceId,
      type: "MATCH_INVERSO_TIMEOUT",
      payload: { leadId, propertyId: property.id, taskId },
      runAt: new Date(Date.now() + TIMEOUT_MS),
      dedupeKey: `match-inverso:${property.id}:${leadId}`,
    });
  }
}
