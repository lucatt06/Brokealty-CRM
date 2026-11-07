import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { InventarioClient } from "@/components/inventario/inventario-client";

function computeDaysInLot(arrivalDate: Date | null, createdAt: Date, soldDate: Date | null) {
  const start = arrivalDate ?? createdAt;
  const end = soldDate ?? new Date();
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

export default async function InventarioPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const [vehicles, tags] = await Promise.all([
    prisma.vehicle.findMany({
      where: { workspaceId },
      include: {
        photos: { orderBy: { order: "asc" } },
        tags: { select: { id: true, name: true, color: true } },
        priceHistory: { orderBy: { createdAt: "desc" }, take: 20 },
        _count: { select: { deals: true, leads: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tag.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = vehicles.map((v) => ({
    ...v,
    daysInLot: computeDaysInLot(v.arrivalDate, v.createdAt, v.soldDate),
    arrivalDate: v.arrivalDate?.toISOString() ?? null,
    soldDate: v.soldDate?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    priceHistory: v.priceHistory.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    dealsCount: v._count.deals,
    leadsCount: v._count.leads,
  }));

  return (
    <InventarioClient
      vehicles={serialized}
      tags={tags}
      workspaceId={workspaceId}
    />
  );
}
