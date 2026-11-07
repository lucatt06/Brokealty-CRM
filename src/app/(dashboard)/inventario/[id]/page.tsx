import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { VehicleDetailClient } from "@/components/inventario/vehicle-detail-client";

export default async function VehicleDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.id, workspaceId },
    include: {
      photos: { orderBy: { order: "asc" } },
      tags: true,
      conduces: {
        orderBy: { createdAt: "desc" },
        include: { authorizedBy: { select: { id: true, name: true } }, lead: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
  if (!vehicle) notFound();

  const serialized = {
    ...vehicle,
    arrivalDate: vehicle.arrivalDate?.toISOString() ?? null,
    soldDate: vehicle.soldDate?.toISOString() ?? null,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    conduces: vehicle.conduces.map((c) => ({
      ...c,
      expectedReturnAt: c.expectedReturnAt?.toISOString() ?? null,
      actualReturnAt: c.actualReturnAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  };

  return <VehicleDetailClient vehicle={serialized} canManageConduces={ctx.role === "ADMIN_DEALER" || ctx.isSuperAdmin} />;
}
