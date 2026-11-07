import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { ConducesListClient } from "@/components/conduces/conduces-list-client";

export default async function ConducesPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");

  const conduces = await prisma.conduce.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: {
      vehicle: { select: { id: true, make: true, model: true, year: true, vin: true } },
      authorizedBy: { select: { name: true } },
      lead: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const serialized = conduces.map((c) => ({
    id: c.id,
    type: c.type,
    reason: c.reason,
    reasonDetail: c.reasonDetail,
    status: c.status,
    driverName: c.driverName,
    destinationLocation: c.destinationLocation,
    mileageAtMovement: c.mileageAtMovement,
    documentUrl: c.documentUrl,
    expectedReturnAt: c.expectedReturnAt?.toISOString() ?? null,
    actualReturnAt: c.actualReturnAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    vehicle: c.vehicle,
    authorizedByName: c.authorizedBy.name,
    leadName: c.lead ? `${c.lead.firstName} ${c.lead.lastName ?? ""}`.trim() : null,
  }));

  return <ConducesListClient conduces={serialized} />;
}
