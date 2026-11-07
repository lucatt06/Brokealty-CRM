import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { CalendarClient } from "@/components/calendarios/calendar-client";

export default async function CalendariosPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0);

  const [appointments, leads, workspaceUsers] = await Promise.all([
    prisma.appointment.findMany({
      where: { workspaceId, startAt: { gte: rangeStart, lte: rangeEnd } },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.lead.findMany({
      where: { workspaceId },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.workspaceUser.findMany({
      where: { workspaceId },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const serialized = appointments.map((a) => ({
    ...a,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    leadName: a.lead ? `${a.lead.firstName} ${a.lead.lastName ?? ""}`.trim() : null,
    leadPhone: a.lead?.phone ?? null,
  }));

  const users = workspaceUsers.map((wu) => wu.user);

  return (
    <CalendarClient
      appointments={serialized}
      leads={leads}
      users={users}
      workspaceId={workspaceId}
    />
  );
}
