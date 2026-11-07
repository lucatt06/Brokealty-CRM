"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "CHEQUE" | "FINANCIAMIENTO" | "OTRO";

export async function registerPayment(
  workspaceId: string,
  dealId: string,
  amount: number,
  currency: string,
  method: PaymentMethod,
  paidAt: string,
  note?: string,
) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { leadId: true } });
  if (!deal) throw new Error("Negocio no encontrado");

  await prisma.$transaction([
    prisma.payment.create({
      data: { workspaceId, dealId, amount, currency, method, note: note || null, paidAt: new Date(paidAt) },
    }),
    prisma.activity.create({
      data: {
        workspaceId,
        leadId: deal.leadId,
        type: "NOTE_ADDED",
        description: `Pago registrado: ${new Intl.NumberFormat("es-DO", { style: "currency", currency: currency === "USD" ? "USD" : "DOP", maximumFractionDigits: 0 }).format(amount)}`,
      },
    }),
  ]);

  revalidatePath("/conversaciones");
  revalidatePath("/leads");
  revalidatePath("/negocios");
}

export async function deletePayment(paymentId: string) {
  await prisma.payment.delete({ where: { id: paymentId } });
  revalidatePath("/conversaciones");
  revalidatePath("/leads");
  revalidatePath("/negocios");
}
