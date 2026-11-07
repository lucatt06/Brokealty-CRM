import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { InventarioClient } from "@/components/inventario/inventario-client";

function computeDaysListed(listedAt: Date | null, createdAt: Date, soldDate: Date | null) {
  const start = listedAt ?? createdAt;
  const end = soldDate ?? new Date();
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

export default async function InventarioPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const [properties, tags, members] = await Promise.all([
    prisma.property.findMany({
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
    prisma.workspaceUser.findMany({
      where: { workspaceId, isActive: true },
      select: { user: { select: { id: true, name: true } } },
    }).then((rows) => rows.map((r) => r.user)),
  ]);

  const serialized = properties.map((v) => ({
    ...v,
    daysListed: computeDaysListed(v.listedAt, v.createdAt, v.soldDate),
    listedAt: v.listedAt?.toISOString() ?? null,
    soldDate: v.soldDate?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    priceHistory: v.priceHistory.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    dealsCount: v._count.deals,
    leadsCount: v._count.leads,
  }));

  return (
    <InventarioClient
      properties={serialized}
      tags={tags}
      workspaceId={workspaceId}
      members={members}
    />
  );
}
