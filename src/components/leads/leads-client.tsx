"use client";

import { STAGE_FILTER_OPTIONS, stageBadgeClass } from "@/lib/pipeline/default-stages";
import { PROPERTY_TYPE_LABELS, desiredSummary } from "@/lib/properties/labels";
import type { ListingType, PropertyType } from "@prisma/client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, ChevronDown, Phone, Mail,
  MoreHorizontal, Trash2, MessageSquare, Star, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { CreateLeadDialog } from "./create-lead-dialog";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp", FACEBOOK: "Facebook", INSTAGRAM: "Instagram",
  TIKTOK: "TikTok", WEB: "Web", REFERIDO: "Referido",
  MANUAL: "Manual", LLAMADA: "Llamada", EMAIL: "Email", WALK_IN: "Walk-in",
};
const SOURCE_COLORS: Record<string, string> = {
  WHATSAPP: "bg-green-100 text-green-700", FACEBOOK: "bg-blue-100 text-blue-700",
  INSTAGRAM: "bg-pink-100 text-pink-700", TIKTOK: "bg-gray-100 text-gray-700",
  WEB: "bg-indigo-100 text-indigo-700", REFERIDO: "bg-purple-100 text-purple-700",
  MANUAL: "bg-gray-100 text-gray-600", LLAMADA: "bg-orange-100 text-orange-700",
  EMAIL: "bg-cyan-100 text-cyan-700", WALK_IN: "bg-yellow-100 text-yellow-700",
};
const SCORE_RANGES = [
  { label: "Todos", min: 0, max: 100 },
  { label: "Alto (80-100)", min: 80, max: 100 },
  { label: "Medio (50-79)", min: 50, max: 79 },
  { label: "Bajo (0-49)", min: 0, max: 49 },
];
const STAGES = STAGE_FILTER_OPTIONS;

function scoreColor(s: number) {
  if (s >= 80) return "text-green-600";
  if (s >= 50) return "text-amber-600";
  return "text-gray-400";
}

type DealStage = { id: string; name: string; color: string; order: number };
type DealProperty = { id: string; title: string };
type Deal = {
  id: string; status: string; value: number | null; currency: string;
  stage: DealStage | null; property: DealProperty | null;
  createdAt: string; updatedAt: string; closedAt: string | null;
};
type Lead = {
  id: string; firstName: string; lastName: string | null;
  phone: string; email: string | null; source: string; stage: string | null;
  score: number; createdAt: string; assignedUser: { id: string; name: string } | null;
  desiredPropertyType: PropertyType | null; desiredListingType: ListingType | null;
  desiredCity: string | null; desiredSector: string | null; desiredBedrooms: number | null;
  budgetMin: number | null; budgetMax: number | null;
  deals: Deal[];
};
type User = { id: string; name: string };

interface LeadsClientProps { leads: Lead[]; users: User[]; workspaceId: string; }

type ScoreKey = "Todos" | "Alto (80-100)" | "Medio (50-79)" | "Bajo (0-49)";

export function LeadsClient({ leads: initialLeads, users, workspaceId }: LeadsClientProps) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("Todos");
  const [sourceFilter, setSourceFilter] = useState("Todos");
  const [interestFilter, setInterestFilter] = useState("Todos");
  const [scoreFilter, setScoreFilter] = useState<ScoreKey>("Todos");
  const [assignedFilter, setAssignedFilter] = useState("Todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Tipos de propiedad que buscan los leads
  const makes = useMemo(() => {
    const set = new Set(leads.map((l) => l.desiredPropertyType).filter(Boolean).map((t) => PROPERTY_TYPE_LABELS[t as PropertyType]));
    return Array.from(set).sort();
  }, [leads]);

  const scoreRange = SCORE_RANGES.find((r) => r.label === scoreFilter) ?? SCORE_RANGES[0];

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const fullName = `${l.firstName} ${l.lastName ?? ""}`.toLowerCase();
      const matchSearch = !search ||
        fullName.includes(search.toLowerCase()) ||
        l.phone.includes(search) ||
        l.email?.toLowerCase().includes(search.toLowerCase());
      const matchStage = stageFilter === "Todos" || l.stage === stageFilter;
      const matchSource = sourceFilter === "Todos" || l.source === sourceFilter;
      const matchInterest = interestFilter === "Todos" || (l.desiredPropertyType ? PROPERTY_TYPE_LABELS[l.desiredPropertyType] : null) === interestFilter;
      const matchScore = l.score >= scoreRange.min && l.score <= scoreRange.max;
      const matchAssigned = assignedFilter === "Todos" ||
        (assignedFilter === "Sin asignar" ? !l.assignedUser : l.assignedUser?.id === assignedFilter);
      const created = new Date(l.createdAt);
      const matchDateFrom = !dateFrom || created >= new Date(dateFrom);
      const matchDateTo = !dateTo || created <= new Date(dateTo + "T23:59:59");
      return matchSearch && matchStage && matchSource && matchInterest && matchScore && matchAssigned && matchDateFrom && matchDateTo;
    });
  }, [leads, search, stageFilter, sourceFilter, interestFilter, scoreRange, assignedFilter, dateFrom, dateTo]);

  const activeFilters = [
    stageFilter !== "Todos" && { key: "stage", label: stageFilter, clear: () => setStageFilter("Todos") },
    sourceFilter !== "Todos" && { key: "source", label: SOURCE_LABELS[sourceFilter], clear: () => setSourceFilter("Todos") },
    interestFilter !== "Todos" && { key: "interest", label: interestFilter, clear: () => setInterestFilter("Todos") },
    scoreFilter !== "Todos" && { key: "score", label: scoreFilter, clear: () => setScoreFilter("Todos") },
    assignedFilter !== "Todos" && { key: "assigned", label: assignedFilter === "Sin asignar" ? "Sin asignar" : users.find((u) => u.id === assignedFilter)?.name ?? "", clear: () => setAssignedFilter("Todos") },
    (dateFrom || dateTo) && { key: "date", label: `${dateFrom || "…"} → ${dateTo || "…"}`, clear: () => { setDateFrom(""); setDateTo(""); } },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  function clearAll() {
    setStageFilter("Todos"); setSourceFilter("Todos"); setInterestFilter("Todos");
    setScoreFilter("Todos"); setAssignedFilter("Todos"); setDateFrom(""); setDateTo("");
  }

  async function handleDelete(id: string) {
    await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  function handleCreated(lead: Lead) {
    setLeads((prev) => [lead, ...prev]);
    setDialogOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Toolbar principal ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        {/* Search */}
        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Nombre, teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>

        {/* Interés */}
        <FilterDropdown label="Interés" active={interestFilter !== "Todos"} value={interestFilter === "Todos" ? undefined : interestFilter}>
          <DropdownMenuItem onClick={() => setInterestFilter("Todos")}>Todos</DropdownMenuItem>
          {makes.map((m) => <DropdownMenuItem key={m} onClick={() => setInterestFilter(m)} className={cn(interestFilter === m && "font-semibold text-primary")}>{m}</DropdownMenuItem>)}
        </FilterDropdown>

        {/* Etapa */}
        <FilterDropdown label="Etapa" active={stageFilter !== "Todos"} value={stageFilter === "Todos" ? undefined : stageFilter}>
          {STAGES.map((s) => <DropdownMenuItem key={s} onClick={() => setStageFilter(s)} className={cn(stageFilter === s && "font-semibold text-primary")}>{s}</DropdownMenuItem>)}
        </FilterDropdown>

        {/* Fuente */}
        <FilterDropdown label="Fuente" active={sourceFilter !== "Todos"} value={sourceFilter === "Todos" ? undefined : SOURCE_LABELS[sourceFilter]}>
          <DropdownMenuItem onClick={() => setSourceFilter("Todos")}>Todos</DropdownMenuItem>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <DropdownMenuItem key={k} onClick={() => setSourceFilter(k)} className={cn(sourceFilter === k && "font-semibold text-primary")}>{v}</DropdownMenuItem>)}
        </FilterDropdown>

        {/* Score */}
        <FilterDropdown label="Score" active={scoreFilter !== "Todos"} value={scoreFilter === "Todos" ? undefined : scoreFilter}>
          {SCORE_RANGES.map((r) => <DropdownMenuItem key={r.label} onClick={() => setScoreFilter(r.label as ScoreKey)} className={cn(scoreFilter === r.label && "font-semibold text-primary")}>{r.label}</DropdownMenuItem>)}
        </FilterDropdown>

        {/* Asignado */}
        <FilterDropdown label="Asignado" active={assignedFilter !== "Todos"} value={assignedFilter === "Todos" ? undefined : (assignedFilter === "Sin asignar" ? "Sin asignar" : users.find((u) => u.id === assignedFilter)?.name)}>
          <DropdownMenuItem onClick={() => setAssignedFilter("Todos")}>Todos</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAssignedFilter("Sin asignar")}>Sin asignar</DropdownMenuItem>
          {users.map((u) => <DropdownMenuItem key={u.id} onClick={() => setAssignedFilter(u.id)} className={cn(assignedFilter === u.id && "font-semibold text-primary")}>{u.name}</DropdownMenuItem>)}
        </FilterDropdown>

        {/* Fecha */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-sm", (dateFrom || dateTo) && "border-primary text-primary")}>
              {dateFrom || dateTo ? `${dateFrom || "…"} → ${dateTo || "…"}` : "Fecha"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hasta</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                  Limpiar fechas
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{filtered.length} leads</span>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo lead
          </Button>
        </div>
      </div>

      {/* ── Chips de filtros activos ── */}
      <AnimatePresence>
        {activeFilters.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-muted/30 overflow-hidden"
          >
            <span className="text-xs text-muted-foreground shrink-0">Filtros:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeFilters.map((f) => (
                <span key={f.key} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5">
                  {f.label}
                  <button onClick={f.clear} className="hover:text-primary/60">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <button onClick={clearAll} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
              Limpiar todo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabla ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">Nombre</th>
              <th className="px-4 py-2.5 text-left font-medium">Contacto</th>
              <th className="px-4 py-2.5 text-left font-medium">Interés</th>
              <th className="px-4 py-2.5 text-left font-medium">Etapa</th>
              <th className="px-4 py-2.5 text-left font-medium">Fuente</th>
              <th className="px-4 py-2.5 text-left font-medium">Score</th>
              <th className="px-4 py-2.5 text-left font-medium">Asignado</th>
              <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {filtered.map((lead, i) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.18, delay: i * 0.02 }}
                  className="border-b border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="flex items-center gap-2.5 hover:underline text-left"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {lead.firstName[0]}{lead.lastName?.[0] ?? ""}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{lead.firstName} {lead.lastName}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-xs text-foreground">
                        <Phone className="h-3 w-3 text-muted-foreground" />{lead.phone}
                      </span>
                      {lead.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />{lead.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {desiredSummary(lead)
                      ? <span className="text-xs text-foreground">{desiredSummary(lead)}</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {lead.stage
                      ? <Badge className={cn("text-[11px] font-medium border-0", stageBadgeClass(lead.stage))}>{lead.stage}</Badge>
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={cn("text-[11px] font-medium border-0", SOURCE_COLORS[lead.source])}>
                      {SOURCE_LABELS[lead.source]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className={cn("flex items-center gap-1 font-semibold text-sm", scoreColor(lead.score))}>
                      <Star className="h-3 w-3" />{lead.score}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {lead.assignedUser
                      ? <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[9px]">{lead.assignedUser.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-foreground">{lead.assignedUser.name}</span>
                        </div>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString("es-DO", { day: "2-digit", month: "short" })}
                  </td>
                  <td className="px-2 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/leads/${lead.id}`)}>
                          <MessageSquare className="h-4 w-4 mr-2" />Ver conversación
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => handleDelete(lead.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No se encontraron leads</p>
            <p className="text-xs text-muted-foreground mt-1">Ajusta los filtros o crea uno nuevo</p>
          </div>
        )}
      </div>

      <CreateLeadDialog open={dialogOpen} onOpenChange={setDialogOpen} users={users} workspaceId={workspaceId} onCreated={handleCreated} />
    </div>
  );
}

// ── Componente auxiliar reutilizable para dropdowns de filtro ──
function FilterDropdown({ label, icon, active, value, children }: {
  label: string; icon?: React.ReactNode; active?: boolean; value?: string; children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-sm", active && "border-primary text-primary")}>
          {icon}
          {value ?? label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
