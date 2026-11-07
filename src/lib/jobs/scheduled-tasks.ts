import { prisma } from "@/lib/prisma";
import type { Prisma, ScheduledTaskType } from "@prisma/client";

type ScheduleTaskInput = {
  workspaceId: string;
  type: ScheduledTaskType;
  payload: Record<string, unknown>;
  runAt: Date;
  /**
   * Si se pasa, la tarea se crea o se actualiza (upsert) en vez de duplicarse.
   * Esto es lo que implementa "debounce" (un mensaje nuevo extiende la misma
   * tarea de respuesta en vez de crear una segunda) y "reprogramar" (un timer
   * de reactivación que se reinicia) sin código especial por cada caso de uso.
   */
  dedupeKey?: string;
};

export async function scheduleTask({ workspaceId, type, payload, runAt, dedupeKey }: ScheduleTaskInput) {
  const data = {
    workspaceId,
    type,
    payload: payload as Prisma.InputJsonValue,
    runAt,
    status: "PENDING" as const,
    attempts: 0,
    lastError: null,
  };

  if (dedupeKey) {
    return prisma.scheduledTask.upsert({
      where: { dedupeKey },
      update: data,
      create: { ...data, dedupeKey },
    });
  }

  return prisma.scheduledTask.create({ data });
}

export async function cancelScheduledTask(dedupeKey: string) {
  await prisma.scheduledTask.updateMany({
    where: { dedupeKey, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}
