import { prisma } from "@/lib/prisma";

/**
 * Job diario (Documento 7, sección 4.2): marca EXPIRADA toda cotización ENVIADA
 * cuyo validUntil ya pasó. Una cotización expirada no puede convertirse — debe
 * regenerarse.
 */
export async function runQuoteExpirationCheck() {
  const result = await prisma.quote.updateMany({
    where: { status: "ENVIADA", validUntil: { lt: new Date() } },
    data: { status: "EXPIRADA" },
  });
  return { expired: result.count };
}
