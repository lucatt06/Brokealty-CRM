import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { SalesOrderDetailClient } from "@/components/sales-orders/sales-order-detail-client";

export default async function SalesOrderDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, workspaceId },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
      vehicle: { select: { id: true, make: true, model: true, year: true, vin: true, minimumPrice: true, priceDOP: true, priceUSD: true } },
      quote: { select: { id: true, quoteNumber: true } },
      ddc: true,
      soldBy: { select: { id: true, name: true } },
      authorizations: {
        include: { requestedBy: { select: { id: true, name: true } }, decidedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      contracts: { include: { template: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      procedures: { include: { assignedTo: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const [leadDdcs, templates, members] = await Promise.all([
    prisma.customerDueDiligence.findMany({ where: { leadId: order.leadId }, orderBy: { createdAt: "desc" } }),
    prisma.contractTemplate.findMany({ where: { workspaceId, isActive: true }, select: { id: true, name: true } }),
    prisma.workspaceUser.findMany({ where: { workspaceId }, include: { user: { select: { id: true, name: true } } } }),
  ]);

  const serialized = {
    ...order,
    saleDate: order.saleDate?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    firstPaymentDate: order.firstPaymentDate?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    ddc: order.ddc ? { ...order.ddc, dateOfBirth: order.ddc.dateOfBirth?.toISOString() ?? null, reviewedAt: order.ddc.reviewedAt?.toISOString() ?? null, expiresAt: order.ddc.expiresAt?.toISOString() ?? null, createdAt: order.ddc.createdAt.toISOString(), updatedAt: order.ddc.updatedAt.toISOString() } : null,
    authorizations: order.authorizations.map((a) => ({ ...a, decidedAt: a.decidedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString() })),
    contracts: order.contracts.map((c) => ({ ...c, sentAt: c.sentAt?.toISOString() ?? null, signedAt: c.signedAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })),
    documents: order.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
    procedures: order.procedures.map((p) => ({ ...p, dueDate: p.dueDate?.toISOString() ?? null, completedAt: p.completedAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() })),
  };

  const serializedDdcs = leadDdcs.map((d) => ({
    ...d, dateOfBirth: d.dateOfBirth?.toISOString() ?? null, reviewedAt: d.reviewedAt?.toISOString() ?? null,
    expiresAt: d.expiresAt?.toISOString() ?? null, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
  }));

  return (
    <SalesOrderDetailClient
      order={serialized}
      leadDdcs={serializedDdcs}
      templates={templates}
      users={members.map((m) => m.user)}
      canManage={ctx.role === "ADMIN_DEALER" || ctx.isSuperAdmin}
      workspaceId={workspaceId}
    />
  );
}
