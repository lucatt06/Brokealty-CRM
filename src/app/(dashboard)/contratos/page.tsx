import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { ContratosListClient } from "@/components/contracts/contratos-list-client";

export default async function ContratosPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const isAdmin = ctx.role === "ADMIN" || ctx.isSuperAdmin;

  const contracts = await prisma.contract.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: {
      salesOrder: {
        select: {
          id: true, orderNumber: true,
          lead: { select: { firstName: true, lastName: true } },
          property: { select: { title: true } },
        },
      },
      template: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const serialized = contracts.map((c) => ({
    id: c.id,
    status: c.status,
    documentUrl: c.documentUrl,
    templateName: c.template?.name ?? "—",
    sentAt: c.sentAt?.toISOString() ?? null,
    signedAt: c.signedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    salesOrder: {
      id: c.salesOrder.id,
      orderNumber: c.salesOrder.orderNumber,
      leadName: `${c.salesOrder.lead.firstName} ${c.salesOrder.lead.lastName ?? ""}`.trim(),
      propertyLabel: `${c.salesOrder.property.title}`,
    },
  }));

  return <ContratosListClient contracts={serialized} isAdmin={isAdmin} />;
}
