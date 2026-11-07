import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { ConversacionesClient } from "@/components/conversaciones/conversaciones-client";

export default async function ConversacionesPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const [conversations, pipeline, properties] = await Promise.all([
    prisma.conversation.findMany({
      where: { workspaceId },
      include: {
        lead: {
          select: {
            id: true, workspaceId: true,
            firstName: true, lastName: true, phone: true, stage: true, score: true, source: true,
            activities: {
              select: { id: true, type: true, description: true, userId: true, createdAt: true, metadata: true },
              orderBy: { createdAt: "asc" },
            },
            deals: {
              select: {
                id: true, status: true, value: true, currency: true,
                stage: { select: { id: true, name: true, color: true } },
                property: { select: { title: true } },
                payments: {
                  select: { id: true, amount: true, currency: true, method: true, note: true, paidAt: true },
                  orderBy: { paidAt: "desc" },
                },
              },
              orderBy: { createdAt: "asc" },
            },
            tasks: {
              select: { id: true, title: true, description: true, status: true, priority: true, dueAt: true, completedAt: true, createdAt: true },
              orderBy: { createdAt: "desc" },
            },
            appointments: {
              select: { id: true, title: true, notes: true, type: true, status: true, startAt: true, endAt: true, location: true, createdAt: true },
              orderBy: { startAt: "desc" },
            },
          },
        },
        messages: { orderBy: { sentAt: "asc" } },
      },
      orderBy: { lastMessageAt: "desc" },
    }),
    prisma.pipeline.findFirst({
      where: { workspaceId },
      include: { stages: { select: { id: true, name: true, color: true, order: true }, orderBy: { order: "asc" } } },
    }),
    prisma.property.findMany({
      where: { workspaceId },
      select: { id: true, title: true, priceDOP: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const stages = pipeline?.stages ?? [];

  const serialized = conversations.map((c) => ({
    ...c,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    messages: c.messages.map((m) => ({ ...m, sentAt: m.sentAt.toISOString() })),
    lead: c.lead ? {
      ...c.lead,
      activities: c.lead.activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
      deals: c.lead.deals.map((d) => ({
        ...d,
        payments: d.payments.map((p) => ({ ...p, paidAt: p.paidAt.toISOString() })),
      })),
      tasks: c.lead.tasks.map((t) => ({
        ...t,
        dueAt: t.dueAt?.toISOString() ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
      appointments: c.lead.appointments.map((a) => ({
        ...a,
        startAt: a.startAt.toISOString(),
        endAt: a.endAt.toISOString(),
        createdAt: a.createdAt.toISOString(),
      })),
    } : null,
  }));

  return (
    <ConversacionesClient
      conversations={serialized}
      stages={stages}
      pipelineId={pipeline?.id ?? null}
      properties={properties}
    />
  );
}
