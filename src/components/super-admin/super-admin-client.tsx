"use client";

import { motion } from "framer-motion";
import {
  Building2,
  Users,
  MessageSquare,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  ScrollText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";
import type { SuperAdminOverview } from "@/app/actions/super-admin";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

const ACTION_LABELS: Record<string, string> = {
  TENANT_CREATED: "Tenant creado",
  TENANT_DUPLICATED: "Tenant duplicado",
  TENANT_SUSPENDED: "Tenant suspendido",
  TENANT_REACTIVATED: "Tenant reactivado",
  TENANT_DELETED: "Tenant eliminado",
  TENANT_SWITCHED: "Cambio de tenant activo",
  PLAN_CHANGED: "Plan cambiado",
};

const ACTION_COLOR: Record<string, string> = {
  TENANT_CREATED: "text-emerald-600 bg-emerald-50 border-emerald-200",
  TENANT_DUPLICATED: "text-blue-600 bg-blue-50 border-blue-200",
  TENANT_SUSPENDED: "text-amber-600 bg-amber-50 border-amber-200",
  TENANT_REACTIVATED: "text-emerald-600 bg-emerald-50 border-emerald-200",
  TENANT_DELETED: "text-red-600 bg-red-50 border-red-200",
  TENANT_SWITCHED: "text-muted-foreground bg-muted border-border",
  PLAN_CHANGED: "text-violet-600 bg-violet-50 border-violet-200",
};

const PLAN_LABEL: Record<string, string> = { STARTER: "Starter", PRO: "Pro", ENTERPRISE: "Enterprise" };

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SuperAdminClient({ overview }: { overview: SuperAdminOverview }) {
  const maxTokens = Math.max(1, ...overview.usageByWorkspace.map((u) => u.totalInputTokens + u.totalOutputTokens));

  const metrics = [
    { label: "Tenants totales", value: overview.tenantsTotal, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Tenants activos", value: overview.tenantsActive, icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Tenants suspendidos", value: overview.tenantsSuspended, icon: ShieldOff, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Leads totales", value: overview.leadsTotal, icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Conversaciones totales", value: overview.conversationsTotal, icon: MessageSquare, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Super Admin">
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
          Vista cross-tenant
        </Badge>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-4">
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          {/* Metric Cards */}
          <motion.div variants={item} className="grid grid-cols-5 gap-3">
            {metrics.map((m) => {
              const Icon = m.icon;
              return (
                <Card key={m.label} className="border-border shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                        <p className="text-2xl font-bold text-foreground">{m.value}</p>
                      </div>
                      <div className={cn("rounded-lg p-2", m.bg)}>
                        <Icon className={cn("h-5 w-5", m.color)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {/* Tenants table */}
            <motion.div variants={item}>
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-[13px]">Tenants</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-1.5">
                    {overview.tenants.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground">{t.leads} leads · {t.conversations} conversaciones</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {PLAN_LABEL[t.plan] ?? t.plan}
                        </Badge>
                        <Badge
                          className={cn(
                            "text-[10px] shrink-0",
                            t.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          )}
                          variant="outline"
                        >
                          {t.isActive ? "Activo" : "Suspendido"}
                        </Badge>
                      </div>
                    ))}
                    {overview.tenants.length === 0 && (
                      <p className="text-[12px] text-muted-foreground py-4 text-center">Sin tenants todavía.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* AI usage by workspace */}
            <motion.div variants={item}>
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <CardTitle className="text-[13px]">Consumo de IA por tenant (30 días)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2.5">
                  {overview.usageByWorkspace.map((u) => {
                    const total = u.totalInputTokens + u.totalOutputTokens;
                    return (
                      <div key={u.workspaceId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-medium text-foreground truncate">{u.workspaceName}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {formatTokens(total)} tokens · {u.callCount} llamadas
                            {u.sharedKeyTokens > 0 && (
                              <span className="text-amber-600"> · {formatTokens(u.sharedKeyTokens)} en key compartida</span>
                            )}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-sm overflow-hidden">
                          <motion.div
                            className="h-full rounded-sm bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${(total / maxTokens) * 100}%` }}
                            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {overview.usageByWorkspace.length === 0 && (
                    <p className="text-[12px] text-muted-foreground py-4 text-center">Sin actividad de IA en los últimos 30 días.</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Audit log */}
          <motion.div variants={item}>
            <Card className="border-border shadow-none">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                    <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-[13px]">Auditoría — acciones recientes del Super Admin</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1.5">
                  {overview.auditLog.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] shrink-0", ACTION_COLOR[log.action] ?? "text-muted-foreground bg-muted border-border")}
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                      <span className="text-[12px] text-foreground truncate flex-1">
                        {log.actorName}
                        {log.workspaceName && <span className="text-muted-foreground"> · {log.workspaceName}</span>}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(log.createdAt)}</span>
                    </div>
                  ))}
                  {overview.auditLog.length === 0 && (
                    <p className="text-[12px] text-muted-foreground py-4 text-center">Sin actividad registrada todavía.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
