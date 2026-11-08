import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { LeadDetailClient } from "@/components/leads/lead-detail-client";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const [lead, users, pipeline] = await Promise.all([
    prisma.lead.findFirst({
      where: { id: params.id, workspaceId },
      include: {
        assignedUser: { select: { id: true, name: true } },
        tags: true,
        interestedProperty: { select: { id: true, title: true } },
        activities: { orderBy: { createdAt: "asc" } },
        deals: {
          include: {
            stage: { select: { id: true, name: true, color: true } },
            property: { select: { title: true } },
            payments: {
              select: { id: true, amount: true, currency: true, method: true, note: true, paidAt: true },
              orderBy: { paidAt: "desc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        tasks: { orderBy: { createdAt: "desc" } },
        appointments: { orderBy: { startAt: "desc" } },
        dueDiligences: { orderBy: { createdAt: "desc" } },
        conversations: {
          include: { messages: { orderBy: { sentAt: "asc" } } },
          orderBy: { lastMessageAt: "desc" },
        },
      },
    }),
    prisma.workspaceUser.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.pipeline.findFirst({
      where: { workspaceId },
      include: { stages: { select: { id: true, name: true, color: true, order: true }, orderBy: { order: "asc" } } },
    }),
  ]);

  if (!lead) notFound();

  const stages = pipeline?.stages ?? [];

  const serialized = {
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    lastContact: lead.lastContact?.toISOString() ?? null,
    scoreUpdatedAt: lead.scoreUpdatedAt?.toISOString() ?? null,
    activities: lead.activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    tasks: lead.tasks.map((t) => ({
      ...t,
      dueAt: t.dueAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    appointments: lead.appointments.map((a) => ({
      ...a,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
    })),
    dueDiligences: lead.dueDiligences.map((d) => ({
      ...d,
      dateOfBirth: d.dateOfBirth?.toISOString() ?? null,
      reviewedAt: d.reviewedAt?.toISOString() ?? null,
      expiresAt: d.expiresAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    deals: lead.deals.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      closedAt: d.closedAt?.toISOString() ?? null,
      expectedCloseAt: d.expectedCloseAt?.toISOString() ?? null,
      payments: d.payments.map((p) => ({ ...p, paidAt: p.paidAt.toISOString() })),
    })),
    conversations: lead.conversations.map((c) => ({
      ...c,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messages: c.messages.map((m) => ({ ...m, sentAt: m.sentAt.toISOString(), reactions: (m.reactions ?? null) as Record<string, string> | null, editedAt: m.editedAt?.toISOString() ?? null, deletedAt: m.deletedAt?.toISOString() ?? null })),
    })),
  };

  return (
    <LeadDetailClient
      lead={serialized}
      users={users.map((wu) => wu.user)}
      stages={stages}
      workspaceId={workspaceId}
      canManage={ctx.role === "ADMIN" || ctx.isSuperAdmin}
    />
  );
}
