import { prisma } from "@/lib/prisma";

/**
 * Job diario (Documento 5, sección 3.8): detecta PostSaleProcedure PENDIENTE/EN_PROCESO
 * con dueDate vencido y notifica al responsable + a los Administrador del workspace —
 * mismo patrón que el job de conduces vencidos de 2A.
 */
export async function runProceduresOverdueCheck() {
  const overdue = await prisma.postSaleProcedure.findMany({
    where: { status: { in: ["PENDIENTE", "EN_PROCESO"] }, dueDate: { lt: new Date() } },
    include: { salesOrder: { select: { orderNumber: true } } },
  });
  if (!overdue.length) return { checked: 0 };

  for (const procedure of overdue) {
    const admins = await prisma.workspaceUser.findMany({
      where: { workspaceId: procedure.workspaceId, role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
      select: { userId: true },
    });
    const notifyUserIds = Array.from(new Set([...(procedure.assignedToId ? [procedure.assignedToId] : []), ...admins.map((a) => a.userId)]));
    if (!notifyUserIds.length) continue;

    await prisma.notification.createMany({
      data: notifyUserIds.map((userId) => ({
        workspaceId: procedure.workspaceId,
        userId,
        title: "Trámite vencido",
        body: `El trámite "${procedure.type}" de la orden ${procedure.salesOrder.orderNumber} superó su fecha límite.`,
        type: "PROCEDURE_OVERDUE",
      })),
    });
  }

  return { checked: overdue.length };
}
