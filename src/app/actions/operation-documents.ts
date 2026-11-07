"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { uploadOperationDocumentFile } from "@/app/actions/storage";
import type { OperationDocumentType } from "@prisma/client";

type CreateOperationDocumentMeta = {
  workspaceId: string;
  type: OperationDocumentType;
  name: string;
  salesOrderId?: string;
  leadId?: string;
};

export async function createOperationDocument(formData: FormData, meta: CreateOperationDocumentMeta) {
  const ctx = await getActiveWorkspace();
  if (!ctx) throw new Error("Sesión no válida.");

  const file = formData.get("file");
  const result = await uploadOperationDocumentFile(formData);
  if (result.error) throw new Error(result.error);

  await prisma.operationDocument.create({
    data: {
      workspaceId: meta.workspaceId, type: meta.type, name: meta.name.trim(),
      url: result.url!, mimeType: file instanceof File ? file.type : null, sizeBytes: file instanceof File ? file.size : null,
      salesOrderId: meta.salesOrderId ?? null, leadId: meta.leadId ?? null,
      uploadedById: ctx.user.id,
    },
  });

  if (meta.salesOrderId) revalidatePath(`/ordenes-venta/${meta.salesOrderId}`);
  revalidatePath("/documentos");
}

export async function deleteOperationDocument(id: string) {
  const doc = await prisma.operationDocument.delete({ where: { id }, select: { salesOrderId: true } });
  if (doc.salesOrderId) revalidatePath(`/ordenes-venta/${doc.salesOrderId}`);
  revalidatePath("/documentos");
}
