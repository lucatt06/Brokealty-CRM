"use server";

import { assertMember, assertOwns, requireCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ProcedureStatus } from "@prisma/client";

export async function updateProcedureStatus(id: string, status: ProcedureStatus, notes?: string) {
  const ctx = await requireCtx();
  await assertOwns("procedure", id, ctx.workspace.id);
  const procedure = await prisma.postSaleProcedure.update({
    where: { id },
    data: { status, completedAt: status === "COMPLETADO" ? new Date() : null, notes: notes?.trim() || undefined },
    select: { workspaceId: true, salesOrderId: true },
  });
  if (status === "COMPLETADO") {
    await prisma.activity.create({
      data: { workspaceId: procedure.workspaceId, type: "PROCEDURE_COMPLETADO", description: "Trámite post-venta completado", metadata: { salesOrderId: procedure.salesOrderId } },
    });
  }
  revalidatePath(`/ordenes-venta/${procedure.salesOrderId}`);
  revalidatePath("/ordenes-venta");
}

export async function assignProcedure(id: string, userId: string | null) {
  const ctx = await requireCtx();
  await assertOwns("procedure", id, ctx.workspace.id);
  await assertMember(userId, ctx.workspace.id);
  const procedure = await prisma.postSaleProcedure.update({ where: { id }, data: { assignedToId: userId }, select: { salesOrderId: true } });
  revalidatePath(`/ordenes-venta/${procedure.salesOrderId}`);
}
