import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { PropertyDetailClient } from "@/components/inventario/property-detail-client";

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const property = await prisma.property.findFirst({
    where: { id: params.id, workspaceId },
    include: {
      photos: { orderBy: { order: "asc" } },
      tags: true,
      capturedBy: { select: { id: true, name: true } },
      priceHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      leads: { select: { id: true, firstName: true, lastName: true, stage: true }, take: 20 },
    },
  });
  if (!property) notFound();

  const serialized = {
    ...property,
    listedAt: property.listedAt?.toISOString() ?? null,
    soldDate: property.soldDate?.toISOString() ?? null,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
    priceHistory: property.priceHistory.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
  };

  return <PropertyDetailClient property={serialized} />;
}
