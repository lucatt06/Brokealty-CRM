"use client";

import { motion } from "framer-motion";
import {
  Users,
  CalendarDays,
  Car,
  TrendingUp,
  AlertTriangle,
  ChevronUp,
  Clock,
  Flame,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

const metrics = [
  {
    label: "Leads de hoy",
    value: "24",
    change: "+8 vs ayer",
    up: true,
    icon: Users,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    label: "Citas esta semana",
    value: "11",
    change: "+3 vs semana pasada",
    up: true,
    icon: CalendarDays,
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    label: "Vehículos disponibles",
    value: "47",
    change: "3 alertas activas",
    up: false,
    icon: Car,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    label: "Ventas del mes",
    value: "RD$4.2M",
    change: "+12% vs mes anterior",
    up: true,
    icon: TrendingUp,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
];

const pipeline = [
  { label: "Nuevo", count: 34, color: "bg-blue-500" },
  { label: "Contactado", count: 28, color: "bg-indigo-500" },
  { label: "Calificado", count: 19, color: "bg-violet-500" },
  { label: "Cita Agendada", count: 11, color: "bg-amber-500" },
  { label: "Visitó Dealer", count: 7, color: "bg-orange-500" },
  { label: "En Negociación", count: 4, color: "bg-rose-500" },
  { label: "Cerrado", count: 9, color: "bg-emerald-500" },
];

const team = [
  { name: "Carlos Mejía", leads: 18, closed: 4, rate: "22%", avatar: "CM" },
  { name: "Ana Paulino", leads: 15, closed: 5, rate: "33%", avatar: "AP" },
  { name: "Luis Torres", leads: 12, closed: 2, rate: "17%", avatar: "LT" },
  { name: "María Santos", leads: 9, closed: 3, rate: "33%", avatar: "MS" },
];

const topVehicles = [
  { name: "Toyota RAV4 2022", queries: 23, badge: "SUV" },
  { name: "Hyundai Tucson 2021", queries: 18, badge: "SUV" },
  { name: "Nissan Frontier 2023", queries: 14, badge: "Pickup" },
  { name: "Honda CR-V 2022", queries: 11, badge: "SUV" },
  { name: "Toyota Corolla 2020", queries: 9, badge: "Sedán" },
];

const appointments = [
  { lead: "Juan Pérez", vehicle: "RAV4 2022", time: "10:00 AM", vendor: "Carlos", type: "Presencial" },
  { lead: "María Rodríguez", vehicle: "Tucson 2021", time: "11:30 AM", vendor: "Ana", type: "Virtual" },
  { lead: "Pedro Díaz", vehicle: "Frontier 2023", time: "2:00 PM", vendor: "Luis", type: "Presencial" },
];

const maxPipeline = Math.max(...pipeline.map((p) => p.count));

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Dashboard">
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
          Últimos 30 días
        </Badge>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-4">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {/* Metric Cards */}
          <motion.div variants={item} className="grid grid-cols-4 gap-3">
            {metrics.map((m) => {
              const Icon = m.icon;
              return (
                <Card key={m.label} className="border-border shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                        <p className="text-2xl font-bold text-foreground">{m.value}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {m.up ? (
                            <ChevronUp className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          )}
                          <span className={cn("text-[11px]", m.up ? "text-emerald-600" : "text-amber-600")}>
                            {m.change}
                          </span>
                        </div>
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

          <div className="grid grid-cols-3 gap-3">
            {/* AI Assistant Card */}
            <motion.div variants={item}>
              <Card className="border-border shadow-none h-full">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <CardTitle className="text-[13px]">IA Asistente — Sugerencia del día</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="rounded-lg bg-muted/50 p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <Flame className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[13px] font-medium text-foreground">Juan Pérez — Score 87</p>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Ha preguntado 3 veces por la RAV4, pidió fotos ayer y tiene cita mañana. Alta probabilidad de cierre.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs flex-1">
                      Ver conversación
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1">
                      Enviar mensaje
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Demanda no satisfecha */}
            <motion.div variants={item}>
              <Card className="border-border shadow-none h-full">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50">
                        <BarChart3 className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <CardTitle className="text-[13px]">Demanda no satisfecha</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary p-0">
                      Ver todo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {[
                    { label: "SUV $20-30K", count: 23 },
                    { label: "Toyota Corolla", count: 18 },
                    { label: "Pickup automática", count: 12 },
                  ].map((d) => (
                    <div key={d.label} className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2">
                      <span className="text-[12px] text-amber-800">{d.label}</span>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 text-[11px]">
                        {d.count} leads
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Inventario en alerta */}
            <motion.div variants={item}>
              <Card className="border-border shadow-none h-full">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-50">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                      </div>
                      <CardTitle className="text-[13px]">Inventario en alerta</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary p-0">
                      Ver todos
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {[
                    { name: "Honda Pilot 2019", days: 63, severity: "critical" },
                    { name: "Nissan Sentra 2020", days: 47, severity: "warning" },
                    { name: "Kia Sportage 2021", days: 31, severity: "alert" },
                  ].map((v) => (
                    <div
                      key={v.name}
                      className={cn(
                        "flex items-center justify-between rounded-md px-3 py-2",
                        v.severity === "critical" && "bg-purple-50",
                        v.severity === "warning" && "bg-yellow-50",
                        v.severity === "alert" && "bg-orange-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            v.severity === "critical" && "bg-purple-500",
                            v.severity === "warning" && "bg-yellow-500",
                            v.severity === "alert" && "bg-orange-500"
                          )}
                        />
                        <span className="text-[12px] text-foreground">{v.name}</span>
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          v.severity === "critical" && "text-purple-700",
                          v.severity === "warning" && "text-yellow-700",
                          v.severity === "alert" && "text-orange-700"
                        )}
                      >
                        {v.days}d
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Pipeline funnel */}
            <motion.div variants={item} className="col-span-2">
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-[13px]">Funnel del Pipeline</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {pipeline.map((stage) => (
                      <div key={stage.label} className="flex items-center gap-3">
                        <span className="w-28 text-right text-[12px] text-muted-foreground shrink-0">
                          {stage.label}
                        </span>
                        <div className="flex-1 h-6 bg-muted rounded-sm overflow-hidden">
                          <motion.div
                            className={cn("h-full rounded-sm", stage.color)}
                            initial={{ width: 0 }}
                            animate={{ width: `${(stage.count / maxPipeline) * 100}%` }}
                            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
                          />
                        </div>
                        <span className="w-6 text-[12px] font-medium text-foreground shrink-0">
                          {stage.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Top vehículos */}
            <motion.div variants={item}>
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-[13px]">Más consultados esta semana</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {topVehicles.map((v, i) => (
                    <div key={v.name} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] truncate text-foreground">{v.name}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{v.badge}</Badge>
                      <span className="text-[11px] text-muted-foreground w-8 text-right shrink-0">
                        {v.queries}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Performance del equipo */}
            <motion.div variants={item}>
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[13px]">Performance del equipo</CardTitle>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary p-0">
                      Ver reportes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {team.map((v, i) => (
                      <div key={v.name} className="flex items-center gap-3 py-1">
                        <span className="text-[11px] text-muted-foreground w-4">{i + 1}</span>
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[11px] bg-primary/10 text-primary">{v.avatar}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{v.name}</p>
                          <p className="text-[11px] text-muted-foreground">{v.leads} leads · {v.closed} cerrados</p>
                        </div>
                        <Badge
                          className={cn(
                            "text-[11px]",
                            i === 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"
                          )}
                          variant="outline"
                        >
                          {v.rate}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Próximas citas */}
            <motion.div variants={item}>
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[13px]">Próximas citas</CardTitle>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary p-0">
                      Ver calendario
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {appointments.map((a) => (
                    <div
                      key={a.lead + a.time}
                      className="flex items-start gap-3 rounded-md border border-border p-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px] bg-muted">{a.lead.slice(0,2)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{a.lead}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{a.vehicle}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {a.time}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] mt-0.5",
                            a.type === "Virtual" ? "text-violet-600 border-violet-200 bg-violet-50" : "text-blue-600 border-blue-200 bg-blue-50"
                          )}
                        >
                          {a.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
