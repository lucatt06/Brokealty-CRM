"use server";

import { AuthError, assertOwns, assertWorkspace, requireAdminCtx, requireCtx } from "@/lib/auth/guards";
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
  const ctx = await requireCtx();
  assertWorkspace(ctx, workspaceId);
  await assertOwns("deal", dealId, workspaceId);
  if (currency !== "DOP" && currency !== "USD") throw new AuthError("Moneda no válida.");
  if (!Number.isFinite(amount) || amount <= 0) throw new AuthError("Monto no válido.");
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
  const ctx = await requireAdminCtx();
  await assertOwns("payment", paymentId, ctx.workspace.id);
  await prisma.payment.delete({ where: { id: paymentId } });
  revalidatePath("/conversaciones");
  revalidatePath("/leads");
  revalidatePath("/negocios");
}
