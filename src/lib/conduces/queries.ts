import { prisma } from "@/lib/prisma";

/**
 * Regla dura (Documento 7, sección 1.2): un vehículo con una prueba de manejo en curso
 * está físicamente fuera del lote — no puede cerrarse una venta mientras eso sea cierto.
 * La usa closeDeal() en src/app/actions/deals.ts antes de completar la cascada de venta.
 */
export async function hasOpenTestDriveConduce(vehicleId: string): Promise<boolean> {
  const openTestDrive = await prisma.conduce.findFirst({
    where: { vehicleId, type: "SALIDA", status: "ABIERTO", reason: "PRUEBA_MANEJO" },
    select: { id: true },
  });
  return !!openTestDrive;
}

/**
 * Conduce de salida generado automáticamente al completar una venta (Documento 7, sección
 * 1.3) — no requiere retorno, se marca CERRADO de inmediato. Devuelve un PrismaPromise sin
 * ejecutar para que closeDeal() lo incluya en su propio $transaction (misma atomicidad que
 * el resto de la cascada de venta).
 */
export function buildEntregaClienteConduce(params: {
  workspaceId: string;
  vehicleId: string;
  authorizedById: string;
  leadId?: string | null;
}) {
  return prisma.conduce.create({
    data: {
      workspaceId: params.workspaceId,
      vehicleId: params.vehicleId,
      type: "SALIDA",
      reason: "ENTREGA_CLIENTE",
      authorizedById: params.authorizedById,
      leadId: params.leadId ?? null,
      status: "CERRADO",
      actualReturnAt: new Date(),
    },
  });
}
