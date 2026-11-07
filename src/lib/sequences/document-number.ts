import { prisma } from "@/lib/prisma";

/**
 * Número atómico por workspace+prefijo+año (ej. COT-2026-0001). El upsert con
 * increment es una sola sentencia UPDATE a nivel de Postgres — el lock de fila
 * serializa escrituras concurrentes sobre la misma clave, sin SQL crudo ni
 * FOR UPDATE explícito.
 */
export async function getNextDocumentNumber(workspaceId: string, prefix: "COT" | "OV" | "OC"): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await prisma.documentSequence.upsert({
    where: { workspaceId_prefix_year: { workspaceId, prefix, year } },
    create: { workspaceId, prefix, year, currentNumber: 1 },
    update: { currentNumber: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(seq.currentNumber).padStart(4, "0")}`;
}
