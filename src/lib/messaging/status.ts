import { prisma } from "@/lib/prisma";

export type ResolvedMessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";

const RANK: Record<ResolvedMessageStatus, number> = { SENT: 0, DELIVERED: 1, READ: 2, FAILED: 0 };

/**
 * Actualiza el estado de un mensaje saliente por su externalId, sin retroceder
 * (ej. un ACK de "entregado" que llega después de "leído" por reordenamiento de
 * red no debe pisar el leído). Compartido entre los webhooks de Evolution y
 * WhatsApp Cloud API — la semántica de sent/delivered/read/failed es la misma
 * en ambos proveedores.
 */
export async function applyMessageStatusUpdate(externalId: string, status: ResolvedMessageStatus) {
  const existing = await prisma.message.findFirst({ where: { externalId } });
  if (!existing) return;
  if (status !== "FAILED" && RANK[existing.status as ResolvedMessageStatus] > RANK[status]) return;
  await prisma.message.update({ where: { id: existing.id }, data: { status } });
}
