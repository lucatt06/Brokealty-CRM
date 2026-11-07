import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, CalendarDays, DollarSign, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/properties/labels";

const DAY_MS = 86_400_000;

type MoneyRow = { currency: string; _sum: { value: number | null } };

/** "US$1.2M · RD$4.5M" — suma por moneda, sin convertir entre ellas. */
function moneyByCurrency(rows: MoneyRow[]) {
  const parts = rows
    .filter((r) => (r._sum.value ?? 0) > 0)
    .map((r) => formatCurrency(r._sum.value ?? 0, r.currency === "USD" ? "USD" : "DOP"));
  return parts.length ? parts.join(" · ") : "—";
}

export default async function DashboardPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;
  // Un agente solo ve lo suyo; administradores ven todo el workspace.
  const own = ctx.role === "AGENTE" ? ctx.user.id : null;

  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + DAY_MS);

  const leadScope = { workspaceId, ...(own ? { assignedTo: own } : {}) };
  const dealScope = { workspaceId, ...(own ? { assignedToId: own } : {}) };
  const apptScope = { workspaceId, ...(own ? { assignedTo: own } : {}) };

  const [
    activeLeads, newLeads, availableProps, reservedProps, openDeals, wonDeals,
    todayAppts, upcoming, stages, leadsByAgent, wonByAgent, topProps,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...leadScope, isActive: true } }),
    prisma.lead.count({ where: { ...leadScope, createdAt: { gte: since } } }),
    prisma.property.count({ where: { workspaceId, status: "DISPONIBLE" } }),
    prisma.property.count({ where: { workspaceId, status: "RESERVADO" } }),
    prisma.deal.groupBy({ by: ["currency"], where: { ...dealScope, status: "OPEN" }, _sum: { value: true }, _count: true }),
    prisma.deal.groupBy({ by: ["currency"], where: { ...dealScope, status: "WON", closedAt: { gte: since } }, _sum: { value: true }, _count: true }),
    prisma.appointment.count({ where: { ...apptScope, startAt: { gte: startOfDay, lt: endOfDay }, status: { in: ["AGENDADA", "CONFIRMADA"] } } }),
    prisma.appointment.findMany({
      where: { ...apptScope, startAt: { gte: now }, status: { in: ["AGENDADA", "CONFIRMADA"] } },
      orderBy: { startAt: "asc" },
      take: 6,
      include: { lead: { select: { firstName: true, lastName: true } } },
    }),
    prisma.pipelineStage.findMany({
      where: { pipeline: { workspaceId, isDefault: true } },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true, _count: { select: { deals: { where: { ...dealScope, status: "OPEN" } } } } },
    }),
    own
      ? Promise.resolve([])
      : prisma.lead.groupBy({ by: ["assignedTo"], where: { workspaceId, isActive: true, assignedTo: { not: null } }, _count: true }),
    own
      ? Promise.resolve([])
      : prisma.deal.groupBy({ by: ["assignedToId"], where: { workspaceId, status: "WON", closedAt: { gte: since }, assignedToId: { not: null } }, _count: true }),
    prisma.property.findMany({
      where: { workspaceId, status: { in: ["DISPONIBLE", "RESERVADO"] } },
      orderBy: { leads: { _count: "desc" } },
      take: 5,
      select: { id: true, title: true, sector: true, _count: { select: { leads: true } } },
    }),
  ]);

  const agentIds = leadsByAgent.map((r) => r.assignedTo).filter((id): id is string => !!id);
  const agents = agentIds.length
    ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
    : [];
  const team = leadsByAgent
    .map((r) => ({
      id: r.assignedTo as string,
      name: agents.find((a) => a.id === r.assignedTo)?.name ?? "—",
      leads: r._count,
      closed: wonByAgent.find((w) => w.assignedToId === r.assignedTo)?._count ?? 0,
    }))
    .sort((a, b) => b.leads - a.leads);

  const openCount = openDeals.reduce((s, r) => s + r._count, 0);
  const wonCount = wonDeals.reduce((s, r) => s + r._count, 0);
  const maxStage = Math.max(1, ...stages.map((s) => s._count.deals));

  const metrics = [
    { label: "Leads activos", value: String(activeLeads), sub: `${newLeads} nuevos en 30 días`, icon: Users, tone: "text-blue-600 bg-blue-50" },
    { label: "Propiedades disponibles", value: String(availableProps), sub: `${reservedProps} reservadas`, icon: Building2, tone: "text-emerald-600 bg-emerald-50" },
    { label: "En negociación", value: moneyByCurrency(openDeals as unknown as MoneyRow[]), sub: `${openCount} negocios abiertos`, icon: DollarSign, tone: "text-violet-600 bg-violet-50" },
    { label: "Citas hoy", value: String(todayAppts), sub: `${wonCount} cierres en 30 días`, icon: CalendarDays, tone: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Dashboard">
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">Últimos 30 días</Badge>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <Card key={m.label} className="border-border shadow-none">
                <CardContent className="p-4 flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                    <p className="text-2xl font-bold text-foreground truncate">{m.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{m.sub}</p>
                  </div>
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${m.tone}`}><Icon className="h-4 w-4" /></div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <Card className="border-border shadow-none xl:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pipeline (negocios abiertos por etapa)</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              {stages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay etapas configuradas.</p>
              ) : stages.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="w-36 text-xs text-muted-foreground truncate">{s.name}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(s._count.deals / maxStage) * 100}%`, backgroundColor: s.color }} />
                  </div>
                  <span className="w-6 text-right text-xs font-semibold text-foreground">{s._count.deals}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Próximas citas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay citas programadas.</p>
              ) : upcoming.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {APPOINTMENT_TYPE_LABELS[a.type]}{a.lead ? ` · ${a.lead.firstName} ${a.lead.lastName ?? ""}` : ""}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {a.startAt.toLocaleString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Santo_Domingo" })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Propiedades con más interés</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {topProps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Agrega propiedades al <Link href="/inventario" className="text-primary hover:underline">catálogo</Link> para verlas aquí.</p>
              ) : topProps.map((p) => (
                <Link key={p.id} href={`/inventario/${p.id}`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1.5 -mx-2">
                  <span className="text-[13px] text-foreground truncate">{p.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{p._count.leads} {p._count.leads === 1 ? "lead" : "leads"}</span>
                </Link>
              ))}
            </CardContent>
          </Card>

          {!own && (
            <Card className="border-border shadow-none">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Equipo</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {team.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Asigna leads a tu equipo para ver su rendimiento.</p>
                ) : team.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <span className="text-[13px] text-foreground truncate">{t.name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{t.leads} leads · {t.closed} cierres</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
