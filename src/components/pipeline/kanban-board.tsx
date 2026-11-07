"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Car, Phone, MessageCircle, Tag, FileText,
  CheckSquare, Calendar, ChevronLeft, ChevronDown, ThumbsUp, ThumbsDown,
  Search, SlidersHorizontal, Filter,
  CheckCircle, XCircle, TrendingUp, LayoutList, LayoutGrid,
  UserCircle2, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  updateDealStage, updateDealStatus, createDeal, updateDealValue,
  closeDeal, updateDealAssignee, updateDealExpectedClose,
} from "@/app/actions/deals";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickActionPanel, type ActionType } from "./quick-action-panel";
import { ActivityTimeline } from "@/components/shared/activity-timeline";

// ── Types ────────────────────────────────────────────────
type Stage = { id: string; name: string; color: string; order: number; probability: number };
type DealActivity = { id: string; type: string; description: string; createdAt: string };
type DealLead = { id: string; firstName: string; lastName: string | null; phone: string; activities: DealActivity[] };
type DealVehicle = { id: string; make: string; model: string; year: number };
type DealUser = { id: string; name: string };
type Deal = {
  id: string; workspaceId: string; leadId: string; vehicleId: string | null;
  stageId: string | null; pipelineId: string;
  value: number | null; currency: string; probability: number;
  status: string; closedAt: string | null; lostReason: string | null;
  assignedToId: string | null; assignedTo: DealUser | null;
  expectedCloseAt: string | null;
  createdAt: string; updatedAt: string;
  lead: DealLead; vehicle: DealVehicle | null; stage: Stage | null;
};
type Pipeline = { id: string; name: string; stages: Stage[]; deals: Deal[] };
type Lead = { id: string; firstName: string; lastName: string | null; phone: string };
type Vehicle = { id: string; make: string; model: string; year: number; priceDOP: number | null };
type WorkspaceUser = { id: string; name: string };

// ── Helpers ──────────────────────────────────────────────
function fmt(value: number | null, currency: string) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-DO", {
    style: "currency", currency: currency === "USD" ? "USD" : "DOP",
    maximumFractionDigits: 0,
  }).format(value);
}

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function initials(lead: { firstName: string; lastName: string | null }) {
  return `${lead.firstName[0]}${lead.lastName?.[0] ?? ""}`.toUpperCase();
}

function userInitials(name: string) {
  const p = name.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

function rotationStyle(days: number): { border: string; badge: string; label: string } {
  if (days < 30) return { border: "", badge: "", label: "" };
  if (days < 45) return { border: "border-l-[3px] border-l-orange-400", badge: "text-orange-500", label: "Atención" };
  if (days < 60) return { border: "border-l-[3px] border-l-yellow-400", badge: "text-yellow-600", label: "Demorado" };
  return { border: "border-l-[3px] border-l-red-500", badge: "text-red-600", label: "Crítico" };
}

function fmtExpectedClose(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" });
}

// ── Deal Card ────────────────────────────────────────────
function DealCard({
  deal, onClick, onAction, overlay = false,
}: { deal: Deal; onClick?: () => void; onAction?: (action: ActionType) => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const days = daysAgo(deal.updatedAt);
  const rot = rotationStyle(days);

  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  const ACTION_BUTTONS: { action: ActionType; Icon: React.ElementType; title: string }[] = [
    { action: "call",        Icon: Phone,         title: "Llamar" },
    { action: "message",     Icon: MessageCircle, title: "Mensaje" },
    { action: "tag",         Icon: Tag,           title: "Etiqueta" },
    { action: "document",    Icon: FileText,      title: "Documento" },
    { action: "task",        Icon: CheckSquare,   title: "Tarea" },
    { action: "appointment", Icon: Calendar,      title: "Cita" },
  ];

  return (
    <div
      ref={setNodeRef} style={style}
      {...(overlay ? {} : { ...listeners, ...attributes })}
      onClick={!isDragging ? onClick : undefined}
      className={cn(
        "bg-white border border-gray-200 rounded-xl cursor-grab active:cursor-grabbing select-none overflow-hidden",
        "transition-all duration-150",
        rot.border,
        isDragging && !overlay ? "opacity-25" : "hover:border-gray-300 hover:shadow-md",
        overlay && "shadow-2xl rotate-1 cursor-grabbing",
      )}
    >
      {/* Top: title + avatar */}
      <div className="px-3.5 pt-3.5 pb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-900 leading-snug">
            {deal.vehicle
              ? `${deal.vehicle.make} · ${deal.vehicle.model} ${deal.vehicle.year}`
              : `${deal.lead.firstName} ${deal.lead.lastName ?? ""}`}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {deal.vehicle
              ? deal.assignedTo?.name ?? "Sin asignar"
              : deal.stage?.name ?? "Sin etapa"}
          </p>
        </div>
        <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold flex items-center justify-center shrink-0">
          {initials(deal.lead)}
        </div>
      </div>

      {/* Middle: Lead + Precio + días */}
      <div className="px-3.5 pb-2.5 space-y-1">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-gray-400">Lead</span>
          <span className="font-medium text-gray-700 truncate max-w-[140px]">
            {deal.lead.firstName} {deal.lead.lastName ?? ""}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-gray-400">Precio</span>
          <span className="font-semibold text-gray-800">{fmt(deal.value, deal.currency)}</span>
        </div>
        {deal.expectedCloseAt && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Cierre</span>
            <span className="text-gray-500">{fmtExpectedClose(deal.expectedCloseAt)}</span>
          </div>
        )}
        {days > 0 && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Días</span>
            <span className={cn("font-medium", rot.badge || "text-gray-400")}>{days}d en etapa</span>
          </div>
        )}
      </div>

      {/* Bottom: action icons + assignee */}
      <div className="px-3 pb-2.5 pt-1 border-t border-gray-100 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          {ACTION_BUTTONS.map(({ action, Icon, title }) => (
            <button key={action} title={title}
              onClick={e => { e.stopPropagation(); onAction?.(action); }}
              className="h-6 w-6 flex items-center justify-center rounded text-gray-300 hover:text-primary hover:bg-primary/5 transition-colors">
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        {deal.assignedTo ? (
          <div title={deal.assignedTo.name}
            className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
            {userInitials(deal.assignedTo.name)}
          </div>
        ) : (
          <div title="Sin asignar"
            className="h-5 w-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center shrink-0">
            <span className="text-[8px] text-gray-300">+</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KanbanColumn ─────────────────────────────────────────
function KanbanColumn({
  id, label, color, count, totalValue, currency, isWon, isLost,
  collapsed, onCollapse, onAddDeal, children,
}: {
  id: string; label: string; color: string;
  count: number; totalValue: number; currency: string;
  isWon?: boolean; isLost?: boolean;
  collapsed: boolean; onCollapse: () => void;
  onAddDeal?: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  if (collapsed) {
    return (
      <div className="flex flex-col items-center w-10 shrink-0">
        <button onClick={onCollapse}
          className="mt-3 mb-2 h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="h-4 w-4 text-gray-400 rotate-180" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[11px] font-semibold whitespace-nowrap"
            style={{ color, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            {label}
          </span>
        </div>
        <span className="mb-3 text-[10px] text-gray-400 font-medium">{count}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[260px] shrink-0">
      <div className="flex items-start justify-between mb-1 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="h-2 w-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: color }} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color }}>{label}</p>
            <p className="text-[11px] text-gray-400">
              {count} negocio{count !== 1 ? "s" : ""} · {fmt(totalValue, currency)}
            </p>
          </div>
        </div>
        <button onClick={onCollapse}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors shrink-0 mt-0.5">
          <ChevronLeft className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[calc(100vh-220px)] rounded-xl p-2 space-y-2 transition-colors duration-150",
          isOver
            ? isWon ? "bg-green-50 ring-2 ring-green-300 ring-inset"
              : isLost ? "bg-red-50 ring-2 ring-red-300 ring-inset"
              : "bg-blue-50/60 ring-2 ring-primary/25 ring-inset"
            : "bg-gray-50",
        )}
      >
        {children}
        {count === 0 && !isOver && (
          <div className="flex items-center justify-center h-20 text-[12px] text-gray-300 font-medium">
            Sin negocios
          </div>
        )}
        {isOver && (
          <div className={cn(
            "h-12 rounded-lg border-2 border-dashed flex items-center justify-center text-[11px] font-medium",
            isWon ? "border-green-400 text-green-600"
              : isLost ? "border-red-400 text-red-500"
              : "border-primary/40 text-primary/60",
          )}>
            {isWon ? "✓ Marcar como ganado" : isLost ? "✗ Marcar como perdido" : "Soltar aquí"}
          </div>
        )}
      </div>

      {!isWon && !isLost && onAddDeal && (
        <button onClick={onAddDeal}
          className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-primary transition-colors px-1 py-1.5 rounded-lg hover:bg-gray-50">
          <Plus className="h-3.5 w-3.5" />
          Agregar negocio
        </button>
      )}
    </div>
  );
}

// ── Closed Deal Card ─────────────────────────────────────
function ClosedDealCard({ deal, onClick, isWon }: { deal: Deal; onClick: () => void; isWon: boolean }) {
  return (
    <div onClick={onClick}
      className={cn(
        "bg-white border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md",
        isWon ? "border-green-200 hover:border-green-300" : "border-red-200 hover:border-red-300",
      )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-gray-900 truncate">
            {deal.vehicle ? `${deal.vehicle.make} ${deal.vehicle.model} ${deal.vehicle.year}` : `${deal.lead.firstName} ${deal.lead.lastName ?? ""}`}
          </p>
          <p className="text-[10px] text-gray-400 truncate">{deal.lead.firstName} {deal.lead.lastName ?? ""}</p>
        </div>
        <div className="h-7 w-7 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center shrink-0">
          {initials(deal.lead)}
        </div>
      </div>
      <p className={cn("text-[13px] font-bold", isWon ? "text-green-700" : "text-red-600")}>
        {fmt(deal.value, deal.currency)}
      </p>
      {deal.lostReason && (
        <p className="text-[10px] text-red-400 truncate mt-0.5">{deal.lostReason}</p>
      )}
    </div>
  );
}

// ── Deal List View ────────────────────────────────────────
function DealListView({
  deals, stages, onDealClick,
}: { deals: Deal[]; stages: Stage[]; onDealClick: (d: Deal) => void }) {
  if (!deals.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
        <FileText className="h-8 w-8 opacity-20" />
        <p className="text-sm">Sin negocios con los filtros actuales</p>
      </div>
    );
  }
  return (
    <div className="px-6 py-4 overflow-x-auto">
      <table className="w-full min-w-[900px] text-[12px]">
        <thead>
          <tr className="border-b border-gray-100">
            {["Lead", "Vehículo", "Etapa", "Valor", "Prob.", "Asignado", "Días", "Cierre esp.", "Estado"].map(h => (
              <th key={h} className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider pb-2 pr-4 first:pl-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map(d => {
            const days = daysAgo(d.updatedAt);
            const rot = rotationStyle(days);
            const stage = stages.find(s => s.id === d.stageId);
            return (
              <tr key={d.id} onClick={() => onDealClick(d)}
                className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors">
                <td className="py-3 pr-4">
                  <p className="font-semibold text-gray-900">{d.lead.firstName} {d.lead.lastName ?? ""}</p>
                  <p className="text-[10px] text-gray-400">{d.lead.phone}</p>
                </td>
                <td className="py-3 pr-4 text-gray-600">
                  {d.vehicle ? `${d.vehicle.make} ${d.vehicle.model} ${d.vehicle.year}` : <span className="text-gray-300">—</span>}
                </td>
                <td className="py-3 pr-4">
                  {stage ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: `${stage.color}18`, color: stage.color }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="py-3 pr-4 font-semibold text-gray-900">{fmt(d.value, d.currency)}</td>
                <td className="py-3 pr-4 text-gray-500">{d.probability}%</td>
                <td className="py-3 pr-4">
                  {d.assignedTo ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                        {userInitials(d.assignedTo.name)}
                      </div>
                      <span className="text-gray-600 truncate max-w-[80px]">{d.assignedTo.name.split(" ")[0]}</span>
                    </div>
                  ) : <span className="text-gray-300">Sin asignar</span>}
                </td>
                <td className="py-3 pr-4">
                  <span className={cn("font-medium", rot.badge || "text-gray-400")}>
                    {days}d
                    {rot.label && <span className="ml-1 text-[10px]">({rot.label})</span>}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-500">
                  {fmtExpectedClose(d.expectedCloseAt) ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="py-3">
                  {d.status === "WON" && <span className="text-[10px] font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">Ganado</span>}
                  {d.status === "LOST" && <span className="text-[10px] font-semibold text-red-600 bg-red-100 rounded-full px-2 py-0.5">Perdido</span>}
                  {d.status === "OPEN" && <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">Abierto</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Create Deal Dialog ────────────────────────────────────
function CreateDealDialog({
  open, onClose, stages, leads, vehicles, workspaceId, pipelineId, defaultStageId,
}: {
  open: boolean; onClose: () => void;
  stages: Stage[]; leads: Lead[]; vehicles: Vehicle[];
  workspaceId: string; pipelineId: string; defaultStageId?: string;
}) {
  const router = useRouter();
  const [leadSearch, setLeadSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [form, setForm] = useState({
    leadId: "", vehicleId: "", stageId: defaultStageId ?? stages[0]?.id ?? "",
    value: "", currency: "DOP",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const filteredLeads = leads.filter(l =>
    `${l.firstName} ${l.lastName ?? ""} ${l.phone}`.toLowerCase().includes(leadSearch.toLowerCase())
  ).slice(0, 8);
  const filteredVehicles = vehicles.filter(v =>
    `${v.make} ${v.model} ${v.year}`.toLowerCase().includes(vehicleSearch.toLowerCase())
  ).slice(0, 8);
  const selectedLead = leads.find(l => l.id === form.leadId);
  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);

  async function handleCreate() {
    if (!form.leadId || !form.stageId) return;
    setSaving(true);
    await createDeal(workspaceId, pipelineId, form.leadId, form.stageId,
      form.value ? parseFloat(form.value) : null, form.currency, form.vehicleId || undefined);
    router.refresh();
    setSaving(false);
    onClose();
    setForm({ leadId: "", vehicleId: "", stageId: stages[0]?.id ?? "", value: "", currency: "DOP" });
    setLeadSearch(""); setVehicleSearch("");
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] bg-white rounded-2xl shadow-2xl p-6"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 35 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-semibold">Nuevo negocio</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              {/* Lead */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Lead *</label>
                {selectedLead ? (
                  <div className="flex items-center gap-2 border border-primary/40 rounded-lg px-3 py-2 bg-primary/5">
                    <div className="h-6 w-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">{initials(selectedLead)}</div>
                    <span className="text-sm flex-1">{selectedLead.firstName} {selectedLead.lastName ?? ""}</span>
                    <button onClick={() => { set("leadId", ""); setLeadSearch(""); }} className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)}
                      placeholder="Buscar lead…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white" />
                    {leadSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-[200px] overflow-y-auto">
                        {filteredLeads.length === 0
                          ? <p className="text-xs text-gray-400 p-3">Sin resultados</p>
                          : filteredLeads.map(l => (
                            <button key={l.id} onClick={() => { set("leadId", l.id); setLeadSearch(""); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-gray-100 text-[10px] font-bold flex items-center justify-center shrink-0">{initials(l)}</div>
                              <div>
                                <p className="font-medium text-[12px]">{l.firstName} {l.lastName ?? ""}</p>
                                <p className="text-[10px] text-gray-400">{l.phone}</p>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Vehicle */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Vehículo <span className="font-normal normal-case">(opcional)</span></label>
                {selectedVehicle ? (
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                    <Car className="h-4 w-4 text-gray-300 shrink-0" />
                    <span className="text-sm flex-1">{selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.year}</span>
                    <button onClick={() => { set("vehicleId", ""); setVehicleSearch(""); }} className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input value={vehicleSearch} onChange={e => setVehicleSearch(e.target.value)}
                      placeholder="Buscar vehículo…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white" />
                    {vehicleSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-[180px] overflow-y-auto">
                        {filteredVehicles.length === 0
                          ? <p className="text-xs text-gray-400 p-3">Sin resultados</p>
                          : filteredVehicles.map(v => (
                            <button key={v.id} onClick={() => {
                              set("vehicleId", v.id);
                              if (v.priceDOP) set("value", String(v.priceDOP));
                              setVehicleSearch("");
                            }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                              <Car className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                              <div>
                                <p className="font-medium text-[12px]">{v.make} {v.model} {v.year}</p>
                                {v.priceDOP && <p className="text-[10px] text-gray-400">{fmt(v.priceDOP, "DOP")}</p>}
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Stage + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Etapa</label>
                  <select value={form.stageId} onChange={e => set("stageId", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white">
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Valor</label>
                  <div className="flex gap-1.5">
                    <select value={form.currency} onChange={e => set("currency", e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-2 text-[11px] outline-none bg-white w-16">
                      <option value="DOP">DOP</option>
                      <option value="USD">USD</option>
                    </select>
                    <input type="number" value={form.value} onChange={e => set("value", e.target.value)}
                      placeholder="0"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white min-w-0" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" disabled={!form.leadId || !form.stageId || saving} onClick={handleCreate}>
                {saving ? "Creando…" : "Crear negocio"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Deal Detail Sheet ─────────────────────────────────────
function DealDetailSheet({
  deal, stages, users, onClose,
}: { deal: Deal | null; stages: Stage[]; users: WorkspaceUser[]; onClose: () => void }) {
  const router = useRouter();
  const [lostReason, setLostReason] = useState("");
  const [showLostForm, setShowLostForm] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [pending, setPending] = useState(false);

  if (!deal) return null;
  const d = deal;

  async function handleStageChange(stageId: string) {
    setPending(true); await updateDealStage(d.id, stageId); router.refresh(); setPending(false);
  }
  async function handleSaveValue() {
    setPending(true);
    await updateDealValue(d.id, newValue ? parseFloat(newValue) : null, d.currency);
    router.refresh(); setEditingValue(false); setPending(false);
  }
  async function handleWon() {
    setPending(true);
    const { salesOrderId } = await closeDeal(d.id, "WON");
    setPending(false); onClose();
    if (salesOrderId) router.push(`/ordenes-venta/${salesOrderId}`);
    else router.refresh();
  }
  async function handleLost() {
    if (!showLostForm) { setShowLostForm(true); return; }
    setPending(true); await closeDeal(d.id, "LOST", lostReason || undefined); router.refresh(); setPending(false); onClose();
  }
  async function handleReopen() {
    setPending(true); await updateDealStatus(d.id, "OPEN"); router.refresh(); setPending(false);
  }
  async function handleAssignee(userId: string | null) {
    setPending(true); await updateDealAssignee(d.id, userId); router.refresh(); setPending(false);
  }
  async function handleExpectedClose(date: string) {
    setPending(true); await updateDealExpectedClose(d.id, date || null); router.refresh(); setPending(false);
  }

  const currentStage = stages.find(s => s.id === d.stageId);

  return (
    <AnimatePresence>
      {deal && (
        <>
          <motion.div className="fixed inset-0 bg-black/20 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-[380px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            {/* ── Header ── */}
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-gray-100 text-gray-600 text-[13px] font-bold flex items-center justify-center shrink-0">
                    {initials(d.lead)}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/leads/${d.lead.id}`} title="Ver ficha completa del lead"
                      className="text-[14px] font-semibold text-gray-900 truncate hover:text-primary transition-colors block">
                      {d.lead.firstName} {d.lead.lastName ?? ""}
                    </Link>
                    <p className="text-[11px] text-gray-400">{d.lead.phone}</p>
                  </div>
                </div>
                <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 shrink-0">
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </div>

              {/* Deal summary chips */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {d.vehicle && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">
                    <Car className="h-3 w-3" /> {d.vehicle.make} {d.vehicle.model} {d.vehicle.year}
                  </span>
                )}
                {/* Valor — click para editar */}
                {editingValue ? (
                  <div className="flex items-center gap-1">
                    <input type="number" value={newValue} onChange={e => setNewValue(e.target.value)}
                      autoFocus
                      onKeyDown={e => { if (e.key === "Enter") handleSaveValue(); if (e.key === "Escape") setEditingValue(false); }}
                      className="w-28 border border-primary/40 rounded-lg px-2 py-0.5 text-[12px] outline-none focus:ring-1 focus:ring-primary bg-white" />
                    <button onClick={handleSaveValue} disabled={pending}
                      className="text-[10px] font-semibold text-primary hover:underline">OK</button>
                    <button onClick={() => setEditingValue(false)}
                      className="text-[10px] text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setNewValue(String(d.value ?? "")); setEditingValue(true); }}
                    className="text-[12px] font-bold text-gray-900 hover:text-primary transition-colors cursor-pointer"
                    title="Click para editar valor">
                    {fmt(d.value, d.currency)}
                  </button>
                )}
                {currentStage && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-1"
                    style={{ backgroundColor: `${currentStage.color}18`, color: currentStage.color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: currentStage.color }} />
                    {currentStage.name}
                  </span>
                )}
                {d.status === "WON" && <span className="text-[11px] font-semibold text-green-700 bg-green-100 rounded-full px-2.5 py-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Ganado</span>}
                {d.status === "LOST" && <span className="text-[11px] font-semibold text-red-600 bg-red-100 rounded-full px-2.5 py-1 flex items-center gap-1"><XCircle className="h-3 w-3" /> Perdido</span>}
              </div>

              {/* Meta fields: Asignado + Cierre esperado */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {/* Asignado */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Asignado</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 text-[11px] text-gray-700 hover:bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-200 w-full transition-colors">
                        {d.assignedTo ? (
                          <>
                            <div className="h-4 w-4 rounded-full bg-primary/10 text-primary text-[8px] font-bold flex items-center justify-center shrink-0">
                              {userInitials(d.assignedTo.name)}
                            </div>
                            <span className="truncate">{d.assignedTo.name.split(" ")[0]}</span>
                          </>
                        ) : (
                          <>
                            <UserCircle2 className="h-4 w-4 text-gray-300 shrink-0" />
                            <span className="text-gray-400">Sin asignar</span>
                          </>
                        )}
                        <ChevronDown className="h-3 w-3 text-gray-400 ml-auto shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem onClick={() => handleAssignee(null)} className="text-xs text-gray-400">
                        Sin asignar
                      </DropdownMenuItem>
                      {users.map(u => (
                        <DropdownMenuItem key={u.id} onClick={() => handleAssignee(u.id)} className="text-xs gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                            {userInitials(u.name)}
                          </div>
                          {u.name}
                          {d.assignedToId === u.id && <span className="ml-auto text-gray-400">✓</span>}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Cierre esperado */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Cierre esperado</p>
                  <div className="relative">
                    <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300 pointer-events-none" />
                    <input
                      type="date"
                      defaultValue={d.expectedCloseAt ? d.expectedCloseAt.slice(0, 10) : ""}
                      onChange={e => handleExpectedClose(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg pl-6 pr-2 py-1.5 text-[11px] text-gray-700 outline-none focus:ring-1 focus:ring-primary bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-2 mt-3">
                {d.status === "OPEN" && (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button disabled={pending}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
                          Mover etapa <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        {stages.map(s => (
                          <DropdownMenuItem key={s.id} onClick={() => handleStageChange(s.id)} className="text-xs gap-2">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            {s.name}
                            {d.stageId === s.id && <span className="ml-auto text-gray-400">actual</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button onClick={handleWon} disabled={pending} title="Crea la Orden de Venta formal — la venta se completa ahí (DDC, autorización si aplica)"
                      className="flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-100 transition-colors">
                      <ThumbsUp className="h-3 w-3" /> Ganado
                    </button>
                    <button onClick={() => setShowLostForm(v => !v)} disabled={pending}
                      className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-100 transition-colors">
                      <ThumbsDown className="h-3 w-3" /> Perdido
                    </button>
                  </>
                )}
                {(d.status === "WON" || d.status === "LOST") && (
                  <button onClick={handleReopen} disabled={pending}
                    className="text-[11px] font-medium text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
                    Reabrir negocio
                  </button>
                )}
              </div>

              {/* Lost form inline */}
              <AnimatePresence>
                {showLostForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mt-2 overflow-hidden">
                    <div className="flex gap-2 pt-1">
                      <input value={lostReason} onChange={e => setLostReason(e.target.value)} autoFocus
                        placeholder="Razón de pérdida…"
                        className="flex-1 border border-red-200 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-red-300 bg-red-50" />
                      <Button variant="destructive" size="sm" disabled={pending} onClick={handleLost} className="h-8 text-xs shrink-0">Confirmar</Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Activity timeline ── */}
            <div className="flex-1 overflow-y-auto">
              <ActivityTimeline
                activities={d.lead.activities}
                emptyLabel="Sin actividades registradas"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── KanbanBoard ───────────────────────────────────────────
export function KanbanBoard({
  pipeline, workspaceId, leads, vehicles, users,
}: {
  pipeline: Pipeline; workspaceId: string;
  leads: Lead[]; vehicles: Vehicle[]; users: WorkspaceUser[];
}) {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>(pipeline.deals);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [quickAction, setQuickAction] = useState<{ deal: Deal; action: ActionType } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"kanban" | "list">("kanban");

  // Filters
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterMinValue, setFilterMinValue] = useState("");
  const [filterMaxValue, setFilterMaxValue] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"fecha" | "valor" | "dias">("fecha");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function toggleCollapse(id: string) {
    setCollapsedCols(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveDeal(deals.find(d => d.id === e.active.id) ?? null);
  }

  async function handleDragEnd(e: { active: { id: unknown }; over: { id: unknown } | null }) {
    const { active, over } = e;
    setActiveDeal(null);
    if (!over) return;
    const dealId = active.id as string;
    const targetId = over.id as string;
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    if (targetId === "WON") {
      // El deal se queda OPEN de verdad hasta que la Orden de Venta se complete —
      // no hay update optimista de status aquí, sería falso.
      const { salesOrderId } = await closeDeal(dealId, "WON");
      if (salesOrderId) router.push(`/ordenes-venta/${salesOrderId}`);
      else router.refresh();
    } else if (targetId === "LOST") {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status: "LOST", closedAt: new Date().toISOString() } : d));
      await closeDeal(dealId, "LOST"); router.refresh();
    } else if (targetId !== deal.stageId) {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stageId: targetId, updatedAt: new Date().toISOString() } : d));
      await updateDealStage(dealId, targetId); router.refresh();
    }
  }

  const openDeals = deals.filter(d => d.status === "OPEN");
  const wonDeals = deals.filter(d => d.status === "WON");
  const lostDeals = deals.filter(d => d.status === "LOST");

  const activeFiltersCount = [search, filterStage, filterAssignee, filterMinValue, filterMaxValue].filter(Boolean).length;

  function filterAndSort(list: Deal[]) {
    let r = list;
    if (search) r = r.filter(d =>
      `${d.lead.firstName} ${d.lead.lastName ?? ""} ${d.vehicle?.make ?? ""} ${d.vehicle?.model ?? ""}`.toLowerCase().includes(search.toLowerCase())
    );
    if (filterStage) r = r.filter(d => d.stageId === filterStage);
    if (filterAssignee === "__unassigned__") r = r.filter(d => !d.assignedToId);
    else if (filterAssignee) r = r.filter(d => d.assignedToId === filterAssignee);
    if (filterMinValue) r = r.filter(d => (d.value ?? 0) >= parseFloat(filterMinValue));
    if (filterMaxValue) r = r.filter(d => (d.value ?? 0) <= parseFloat(filterMaxValue));
    if (sortBy === "valor") r = [...r].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    if (sortBy === "dias") r = [...r].sort((a, b) => daysAgo(b.updatedAt) - daysAgo(a.updatedAt));
    return r;
  }

  const totalOpen = openDeals.reduce((s, d) => s + (d.value ?? 0), 0);
  const totalWon = wonDeals.reduce((s, d) => s + (d.value ?? 0), 0);
  const forecast = openDeals.reduce((s, d) => s + (d.value ?? 0) * (d.probability / 100), 0);
  const currency = deals[0]?.currency ?? "DOP";

  function clearFilters() {
    setSearch(""); setFilterStage(""); setFilterAssignee("");
    setFilterMinValue(""); setFilterMaxValue("");
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Page header ── */}
      <div className="px-6 pt-5 pb-0 border-b border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Filter className="h-4 w-4 text-gray-500" />
              <h1 className="text-[17px] font-bold text-gray-900">{pipeline.name}</h1>
            </div>
            <p className="text-[12px] text-gray-400">
              Arrastra una tarjeta para moverla de etapa manualmente.
            </p>
          </div>
          <Button size="sm" onClick={() => { setDefaultStageId(pipeline.stages[0]?.id); setCreateOpen(true); }}
            className="h-8 gap-1.5 text-[12px] shrink-0">
            <Plus className="h-3.5 w-3.5" /> Nuevo negocio
          </Button>
        </div>

        {/* Summary chips + forecast */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[12px] font-medium text-blue-600 bg-blue-50 rounded-full px-2.5 py-1">
            {openDeals.length} abiertos · {fmt(totalOpen, currency)}
          </span>
          <span className="text-[12px] font-medium text-green-700 bg-green-50 rounded-full px-2.5 py-1">
            {wonDeals.length} ganados · {fmt(totalWon, currency)}
          </span>
          {forecast > 0 && (
            <span className="text-[12px] font-medium text-violet-700 bg-violet-50 rounded-full px-2.5 py-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Forecast · {fmt(forecast, currency)}
            </span>
          )}
        </div>

        {/* Search + filters + sort + view toggle */}
        <div className="flex items-center gap-2 pb-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar negocio, lead o vehículo…"
              className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-primary bg-white" />
          </div>

          {/* Filtros button */}
          <button onClick={() => setShowFilters(v => !v)}
            className={cn(
              "flex items-center gap-1.5 text-[12px] border rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap",
              showFilters || activeFiltersCount > 0
                ? "border-primary text-primary bg-primary/5"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            )}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="h-4 w-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-[12px] text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors whitespace-nowrap">
                {sortBy === "fecha" ? "Fecha" : sortBy === "valor" ? "Valor" : "Días"} <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortBy("fecha")} className="text-xs">Por fecha</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("valor")} className="text-xs">Por valor</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("dias")} className="text-xs">Más tiempo en etapa</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View toggle */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setView("kanban")}
              className={cn("h-8 w-8 flex items-center justify-center transition-colors",
                view === "kanban" ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:bg-gray-50")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView("list")}
              className={cn("h-8 w-8 flex items-center justify-center transition-colors",
                view === "list" ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:bg-gray-50")}>
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Filter panel expandable */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-gray-100 pt-3 pb-3">
              <div className="flex items-end gap-3 flex-wrap">
                {/* Stage filter */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Etapa</label>
                  <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary bg-white min-w-[140px]">
                    <option value="">Todas</option>
                    {pipeline.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {/* Assignee filter */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Asignado</label>
                  <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary bg-white min-w-[140px]">
                    <option value="">Todos</option>
                    <option value="__unassigned__">Sin asignar</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                {/* Value range */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Valor mín.</label>
                  <input type="number" value={filterMinValue} onChange={e => setFilterMinValue(e.target.value)}
                    placeholder="0"
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary bg-white w-28" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Valor máx.</label>
                  <input type="number" value={filterMaxValue} onChange={e => setFilterMaxValue(e.target.value)}
                    placeholder="∞"
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary bg-white w-28" />
                </div>
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters}
                    className="text-[12px] text-red-500 hover:text-red-700 transition-colors pb-1.5">
                    Limpiar filtros
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Content: Kanban or List ── */}
      {view === "list" ? (
        <div className="flex-1 overflow-y-auto">
          <DealListView
            deals={filterAndSort([...openDeals, ...wonDeals, ...lostDeals])}
            stages={pipeline.stages}
            onDealClick={d => setSelectedDeal(d)}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd as never}>
            <div className="flex gap-5 px-6 pt-5 h-full min-w-max">
              {pipeline.stages.map(stage => {
                const stageDeals = filterAndSort(openDeals.filter(d => d.stageId === stage.id));
                const stageTotal = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0);
                const collapsed = collapsedCols.has(stage.id);
                return (
                  <KanbanColumn
                    key={stage.id} id={stage.id}
                    label={stage.name} color={stage.color}
                    count={stageDeals.length} totalValue={stageTotal} currency={currency}
                    collapsed={collapsed} onCollapse={() => toggleCollapse(stage.id)}
                    onAddDeal={() => { setDefaultStageId(stage.id); setCreateOpen(true); }}
                  >
                    <AnimatePresence>
                      {stageDeals.map(deal => (
                        <motion.div key={deal.id}
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.14 }}>
                          <DealCard deal={deal} onClick={() => setSelectedDeal(deal)}
                            onAction={action => setQuickAction({ deal, action })} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </KanbanColumn>
                );
              })}

              <div className="w-px bg-gray-100 shrink-0 self-stretch mx-1" />

              <KanbanColumn
                id="WON" label="Ganado" color="#16a34a"
                count={wonDeals.length}
                totalValue={wonDeals.reduce((s, d) => s + (d.value ?? 0), 0)}
                currency={currency} isWon
                collapsed={collapsedCols.has("WON")} onCollapse={() => toggleCollapse("WON")}
              >
                <AnimatePresence>
                  {filterAndSort(wonDeals).map(deal => (
                    <motion.div key={deal.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <ClosedDealCard deal={deal} onClick={() => setSelectedDeal(deal)} isWon />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </KanbanColumn>

              <KanbanColumn
                id="LOST" label="Perdido" color="#dc2626"
                count={lostDeals.length}
                totalValue={lostDeals.reduce((s, d) => s + (d.value ?? 0), 0)}
                currency={currency} isLost
                collapsed={collapsedCols.has("LOST")} onCollapse={() => toggleCollapse("LOST")}
              >
                <AnimatePresence>
                  {filterAndSort(lostDeals).map(deal => (
                    <motion.div key={deal.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <ClosedDealCard deal={deal} onClick={() => setSelectedDeal(deal)} isWon={false} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </KanbanColumn>
            </div>

            <DragOverlay dropAnimation={null}>
              {activeDeal && <DealCard deal={activeDeal} overlay />}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      <QuickActionPanel
        deal={quickAction?.deal ?? null}
        action={quickAction?.action ?? null}
        onClose={() => setQuickAction(null)}
      />

      <CreateDealDialog
        open={createOpen} onClose={() => setCreateOpen(false)}
        stages={pipeline.stages} leads={leads} vehicles={vehicles}
        workspaceId={workspaceId} pipelineId={pipeline.id}
        defaultStageId={defaultStageId}
      />
      <DealDetailSheet
        deal={selectedDeal}
        stages={pipeline.stages}
        users={users}
        onClose={() => setSelectedDeal(null)}
      />
    </div>
  );
}
