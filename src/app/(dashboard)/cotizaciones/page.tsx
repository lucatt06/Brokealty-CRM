import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { QuotesClient } from "@/components/quotes/quotes-client";

export default async function QuotesPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const [quotes, leads, properties, deals] = await Promise.all([
    prisma.quote.findMany({
      where: { workspaceId },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        property: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.findMany({ where: { workspaceId, isActive: true }, select: { id: true, firstName: true, lastName: true, phone: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.property.findMany({ where: { workspaceId, status: "DISPONIBLE" }, select: { id: true, title: true, priceDOP: true }, orderBy: { createdAt: "desc" } }),
    prisma.deal.findMany({ where: { workspaceId, status: "OPEN" }, select: { id: true, leadId: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const serialized = quotes.map((q) => ({
    ...q,
    validUntil: q.validUntil.toISOString(),
    sentAt: q.sentAt?.toISOString() ?? null,
    respondedAt: q.respondedAt?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  }));

  return <QuotesClient quotes={serialized} leads={leads} properties={properties} dealsByLead={deals} workspaceId={workspaceId} />;
}
