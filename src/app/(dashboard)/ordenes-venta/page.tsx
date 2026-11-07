import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { SalesOrdersListClient } from "@/components/sales-orders/sales-orders-list-client";

export default async function SalesOrdersPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");

  const [orders, pendingProcedures] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        property: { select: { id: true, title: true } },
        authorizations: { where: { status: "PENDIENTE" }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.postSaleProcedure.findMany({
      where: { workspaceId: ctx.workspace.id, status: { in: ["PENDIENTE", "EN_PROCESO"] } },
      include: {
        salesOrder: { select: { orderNumber: true, id: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const serializedOrders = orders.map((o) => ({
    ...o,
    saleDate: o.saleDate?.toISOString() ?? null,
    completedAt: o.completedAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    firstPaymentDate: o.firstPaymentDate?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));

  const serializedProcedures = pendingProcedures.map((p) => ({
    ...p,
    dueDate: p.dueDate?.toISOString() ?? null,
    completedAt: p.completedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return <SalesOrdersListClient orders={serializedOrders} pendingProcedures={serializedProcedures} />;
}
