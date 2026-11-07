import { prisma } from "@/lib/prisma";

/**
 * Barrido periódico (Documento 7, sección 1.1): marca VENCIDO todo conduce de
 * salida ABIERTO cuyo expectedReturnAt ya pasó, y alerta a quien lo autorizó
 * más a los Admin Dealer del workspace — mismo patrón que runTaskDueCheck /
 * runMatchInverso (detectar condición vencida, notificar, dejar Activity).
 */
export async function runConducesVencidosCheck() {
  const overdue = await prisma.conduce.findMany({
    where: { status: "ABIERTO", type: "SALIDA", expectedReturnAt: { lt: new Date() } },
    include: { vehicle: { select: { make: true, model: true, year: true } } },
  });
  if (!overdue.length) return { checked: 0 };

  for (const conduce of overdue) {
    const admins = await prisma.workspaceUser.findMany({
      where: { workspaceId: conduce.workspaceId, role: "ADMIN_DEALER", isActive: true },
      select: { userId: true },
    });
    const notifyUserIds = Array.from(new Set([conduce.authorizedById, ...admins.map((a) => a.userId)]));
    const vehicleLabel = conduce.vehicle
      ? `${conduce.vehicle.make} ${conduce.vehicle.model} ${conduce.vehicle.year}`
      : "el vehículo";

    await prisma.$transaction([
      prisma.conduce.update({ where: { id: conduce.id }, data: { status: "VENCIDO" } }),
      prisma.notification.createMany({
        data: notifyUserIds.map((userId) => ({
          workspaceId: conduce.workspaceId,
          userId,
          title: "Conduce vencido",
          body: `El conduce de salida de ${vehicleLabel} superó el tiempo de retorno esperado.`,
          type: "CONDUCE_VENCIDO",
        })),
      }),
      prisma.activity.create({
        data: {
          workspaceId: conduce.workspaceId,
          vehicleId: conduce.vehicleId,
          type: "CONDUCE_VENCIDO",
          description: `Conduce de salida vencido — ${vehicleLabel} no ha regresado al lote.`,
        },
      }),
    ]);
  }

  return { checked: overdue.length };
}
