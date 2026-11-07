import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { DdcListClient } from "@/components/due-diligence/ddc-list-client";

export default async function DebidaDiligenciaPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const isAdmin = ctx.role === "ADMIN_DEALER" || ctx.isSuperAdmin;

  const records = await prisma.customerDueDiligence.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: { lead: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const serialized = records.map((d) => ({
    id: d.id,
    idDocumentType: d.idDocumentType,
    idDocumentNumber: d.idDocumentNumber,
    fullLegalName: d.fullLegalName,
    isPep: d.isPep,
    riskLevel: d.riskLevel,
    status: d.status,
    rejectionReason: d.rejectionReason,
    expiresAt: d.expiresAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    lead: d.lead,
  }));

  return <DdcListClient records={serialized} isAdmin={isAdmin} />;
}
