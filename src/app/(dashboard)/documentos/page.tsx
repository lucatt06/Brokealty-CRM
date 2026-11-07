import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { DocumentosListClient } from "@/components/operation-documents/documentos-list-client";

export default async function DocumentosPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");

  const [documents, leads] = await Promise.all([
    prisma.operationDocument.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        uploadedBy: { select: { name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.lead.findMany({
      where: { workspaceId: ctx.workspace.id, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const serialized = documents.map((d) => ({
    id: d.id,
    type: d.type,
    name: d.name,
    url: d.url,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    createdAt: d.createdAt.toISOString(),
    uploadedByName: d.uploadedBy.name,
    salesOrder: d.salesOrder,
    lead: d.lead,
  }));

  return (
    <DocumentosListClient
      workspaceId={ctx.workspace.id}
      documents={serialized}
      leads={leads.map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName ?? ""}`.trim() }))}
    />
  );
}
