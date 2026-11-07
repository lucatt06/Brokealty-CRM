import { prisma } from "@/lib/prisma";
import type { Vehicle, Lead, Prisma } from "@prisma/client";
import { scheduleTask } from "./scheduled-tasks";

const TIMEOUT_MS = 30 * 60 * 1000;

function fieldsEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Un lead matchea si TODOS los campos "desired*" que tiene poblados coinciden con el vehículo — nunca exige los 4, ya que en la práctica casi nunca están todos seteados. */
function matchesVehicle(lead: Lead, vehicle: Vehicle): boolean {
  let hasCriteria = false;
  if (lead.desiredMake) {
    hasCriteria = true;
    if (!fieldsEqual(lead.desiredMake, vehicle.make)) return false;
  }
  if (lead.desiredModel) {
    hasCriteria = true;
    if (!fieldsEqual(lead.desiredModel, vehicle.model)) return false;
  }
  if (lead.desiredYear) {
    hasCriteria = true;
    if (lead.desiredYear !== vehicle.year) return false;
  }
  if (lead.desiredColor) {
    hasCriteria = true;
    if (!vehicle.color || !fieldsEqual(lead.desiredColor, vehicle.color)) return false;
  }
  return hasCriteria;
}

/**
 * Cascada "Match Inverso" (CLAUDE.md): al llegar un vehículo nuevo (o duplicado)
 * al inventario, avisa a los leads que lo estaban esperando. Por cada match:
 * crea una Tarea urgente para el vendedor asignado (o queda sin asignar, visible
 * para todo el equipo, si no hay ninguno), una Notification, y una Activity en
 * el lead — todo en una transacción — y programa un timeout de 30 min
 * (ScheduledTask MATCH_INVERSO_TIMEOUT, handler en run-scheduled-tasks.ts) que
 * contacta al lead directamente si nadie completó la tarea a tiempo.
 */
export async function runMatchInverso(vehicle: Vehicle) {
  if (!vehicle.make && !vehicle.model) return;

  const orFilters: Prisma.LeadWhereInput[] = [];
  if (vehicle.make) orFilters.push({ desiredMake: { equals: vehicle.make, mode: "insensitive" } });
  if (vehicle.model) orFilters.push({ desiredModel: { equals: vehicle.model, mode: "insensitive" } });
  if (!orFilters.length) return;

  const candidates = await prisma.lead.findMany({
    where: { workspaceId: vehicle.workspaceId, isActive: true, OR: orFilters },
  });
  const matched = candidates.filter((lead) => matchesVehicle(lead, vehicle));
  if (!matched.length) return;

  const needsAdminFallback = matched.some((lead) => !lead.assignedTo);
  const admins = needsAdminFallback
    ? await prisma.workspaceUser.findMany({
        where: { workspaceId: vehicle.workspaceId, role: "ADMIN_DEALER", isActive: true },
        select: { userId: true },
      })
    : [];

  const vehicleLabel = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;

  const created = await prisma.$transaction(async (tx) => {
    const results: { leadId: string; taskId: string }[] = [];
    for (const lead of matched) {
      const task = await tx.task.create({
        data: {
          workspaceId: vehicle.workspaceId,
          leadId: lead.id,
          assignedTo: lead.assignedTo,
          title: `Match Inverso: llegó ${vehicleLabel} que le interesa a ${lead.firstName}`,
          description: "Contacta al lead antes de que se le avise automáticamente en 30 minutos.",
          priority: "ALTA",
        },
      });

      const targetUserIds = lead.assignedTo ? [lead.assignedTo] : admins.map((a) => a.userId);
      if (targetUserIds.length) {
        await tx.notification.createMany({
          data: targetUserIds.map((userId) => ({
            workspaceId: vehicle.workspaceId,
            userId,
            leadId: lead.id,
            title: "Match Inverso",
            body: `Llegó ${vehicleLabel}, justo lo que buscaba ${lead.firstName}.`,
            type: "MATCH_INVERSO",
          })),
        });
      }

      await tx.activity.create({
        data: {
          workspaceId: vehicle.workspaceId,
          leadId: lead.id,
          type: "MATCH_INVERSO",
          description: `Match Inverso: llegó ${vehicleLabel}, que coincide con lo que buscaba.`,
          metadata: { vehicleId: vehicle.id, taskId: task.id },
        },
      });

      results.push({ leadId: lead.id, taskId: task.id });
    }
    return results;
  });

  for (const { leadId, taskId } of created) {
    await scheduleTask({
      workspaceId: vehicle.workspaceId,
      type: "MATCH_INVERSO_TIMEOUT",
      payload: { leadId, vehicleId: vehicle.id, taskId },
      runAt: new Date(Date.now() + TIMEOUT_MS),
      dedupeKey: `match-inverso:${vehicle.id}:${leadId}`,
    });
  }
}
