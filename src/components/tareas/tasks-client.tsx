"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Trash2, Edit2, ChevronDown, X, Check,
  CheckCircle2, User, Calendar, Flag, MoreHorizontal,
  ListTodo, Link2, Bold, Underline, Italic,
  Strikethrough, List, ListOrdered, Undo2, Redo2, RotateCcw,
  LayoutList, SlidersHorizontal, ArrowUpDown, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  createTask, updateTask, toggleTaskStatus, deleteTask,
} from "@/app/actions/tasks";

// ── Types ─────────────────────────────────────────────────
type TaskStatus = "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA" | "CANCELADA";
type Priority   = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";
type TabKey     = "all" | "today" | "overdue" | "upcoming";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueAt: string | null;
  completedAt: string | null;
  assignedTo: string | null;
  leadId: string | null;
  createdAt: string;
  updatedAt: string;
  lead: { id: string; firstName: string; lastName: string | null; phone: string } | null;
  assignee: { id: string; name: string } | null;
};

type Lead = { id: string; firstName: string; lastName: string | null; phone: string };
type WUser = { id: string; name: string };

// ── Constants ─────────────────────────────────────────────
const STATUS_CFG: Record<TaskStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDIENTE:   { label: "Pendiente",   color: "text-gray-400",  bg: "bg-gray-50",   border: "border-gray-300" },
  EN_PROGRESO: { label: "En progreso", color: "text-blue-600",  bg: "bg-blue-50",   border: "border-blue-400" },
  COMPLETADA:  { label: "Completada",  color: "text-green-600", bg: "bg-green-50",  border: "border-green-400" },
  CANCELADA:   { label: "Cancelada",   color: "text-gray-400",  bg: "bg-gray-100",  border: "border-gray-300" },
};

const PRIORITY_CFG: Record<Priority, { label: string; color: string }> = {
  BAJA:    { label: "Baja",    color: "text-gray-400" },
  MEDIA:   { label: "Media",   color: "text-yellow-500" },
  ALTA:    { label: "Alta",    color: "text-orange-500" },
  URGENTE: { label: "Urgente", color: "text-red-600" },
};

// ── Helpers ───────────────────────────────────────────────
function fmtDue(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-DO", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}
function toDateTimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function leadName(l: Task["lead"]) {
  if (!l) return null;
  return `${l.firstName} ${l.lastName ?? ""}`.trim();
}

// ── Status Icon ───────────────────────────────────────────
function StatusIcon({ status, onClick }: { status: TaskStatus; onClick?: () => void }) {
  if (status === "COMPLETADA") {
    return (
      <button onClick={onClick} className="shrink-0 hover:scale-110 transition-transform">
        <CheckCircle2 className="h-4.5 w-4.5 text-green-500" strokeWidth={2} style={{ width: 18, height: 18 }} />
      </button>
    );
  }
  if (status === "CANCELADA") {
    return (
      <button onClick={onClick} className="shrink-0">
        <div className="h-[18px] w-[18px] rounded-full border-2 border-gray-300 bg-gray-100 flex items-center justify-center">
          <X className="h-2.5 w-2.5 text-gray-400" />
        </div>
      </button>
    );
  }
  return (
    <button onClick={onClick} className="shrink-0 group hover:scale-110 transition-transform">
      <div className={cn("h-[18px] w-[18px] rounded-full border-2 transition-colors",
        status === "EN_PROGRESO" ? "border-blue-400 bg-blue-50" : "border-gray-300 group-hover:border-green-400 group-hover:bg-green-50")}>
        {status === "EN_PROGRESO" && <div className="h-full w-full rounded-full bg-blue-400 scale-50" />}
      </div>
    </button>
  );
}

// ── Rich Text Toolbar ─────────────────────────────────────
function RichToolbar({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  function exec(cmd: string, val?: string) {
    targetRef.current?.focus();
    document.execCommand(cmd, false, val);
  }
  const btn = "h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors";
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 flex-wrap">
      <button className={btn} onMouseDown={e => { e.preventDefault(); exec("bold"); }}><Bold className="h-3.5 w-3.5" /></button>
      <button className={btn} onMouseDown={e => { e.preventDefault(); exec("underline"); }}><Underline className="h-3.5 w-3.5" /></button>
      <button className={btn} onMouseDown={e => { e.preventDefault(); exec("italic"); }}><Italic className="h-3.5 w-3.5" /></button>
      <button className={btn} onMouseDown={e => { e.preventDefault(); exec("strikeThrough"); }}><Strikethrough className="h-3.5 w-3.5" /></button>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <button className={btn} onMouseDown={e => { e.preventDefault(); exec("foreColor", "#2563EB"); }}><span className="text-[10px] font-bold text-blue-600">A</span></button>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <button className={btn} onMouseDown={e => {
        e.preventDefault();
        const url = prompt("URL del enlace:");
        if (url) exec("createLink", url);
      }}><Link2 className="h-3.5 w-3.5" /></button>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <button className={btn} onMouseDown={e => { e.preventDefault(); exec("insertOrderedList"); }}><ListOrdered className="h-3.5 w-3.5" /></button>
      <button className={btn} onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }}><List className="h-3.5 w-3.5" /></button>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <button className={btn} onMouseDown={e => { e.preventDefault(); exec("undo"); }}><Undo2 className="h-3.5 w-3.5" /></button>
      <button className={btn} onMouseDown={e => { e.preventDefault(); exec("redo"); }}><Redo2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

// ── Task Panel (right slide-in) ───────────────────────────
function TaskPanel({ task, leads, users, workspaceId, onClose }: {
  task: Task | null; leads: Lead[]; users: WUser[];
  workspaceId: string; onClose: () => void;
}) {
  const router = useRouter();
  const descRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [showDesc, setShowDesc] = useState(!!(task?.description));
  const [leadSearch, setLeadSearch] = useState("");
  const [showLeadDrop, setShowLeadDrop] = useState(false);
  const [charCount, setCharCount] = useState(task?.description?.replace(/<[^>]*>/g, "").length ?? 0);
  const isEdit = !!task;

  const [form, setForm] = useState({
    title: task?.title ?? "",
    dueAt: toDateTimeLocal(task?.dueAt ?? null),
    assignedTo: task?.assignedTo ?? "",
    leadId: task?.leadId ?? "",
    priority: (task?.priority ?? "MEDIA") as Priority,
    status: (task?.status ?? "PENDIENTE") as TaskStatus,
    recurring: false,
    recurFreq: "SEMANAL" as "DIARIO" | "SEMANAL" | "MENSUAL" | "ANUAL",
    recurInterval: 1,
    recurDays: [1, 2, 3, 4, 5] as number[], // 0=Dom,1=Lun...6=Sáb
    recurEnds: "NUNCA" as "NUNCA" | "FECHA" | "OCURRENCIAS",
    recurEndDate: "",
    recurOccurrences: 10,
  });

  // Set initial description content once — never update via dangerouslySetInnerHTML
  useEffect(() => {
    if (descRef.current && task?.description) {
      descRef.current.innerHTML = task.description;
    }
  }, []);

  const setF = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
  const selectedLead = leads.find(l => l.id === form.leadId);
  const selectedUser = users.find(u => u.id === form.assignedTo);
  const filteredLeads = leads.filter(l =>
    `${l.firstName} ${l.lastName ?? ""} ${l.phone}`.toLowerCase().includes(leadSearch.toLowerCase())
  ).slice(0, 6);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    const descHtml = descRef.current?.innerHTML ?? null;
    const payload = {
      title: form.title.trim(),
      description: showDesc ? (descHtml || null) : null,
      dueAt: form.dueAt || null,
      assignedTo: form.assignedTo || null,
      leadId: form.leadId || null,
      priority: form.priority,
      status: form.status,
    };
    if (isEdit && task) {
      await updateTask(task.id, payload);
    } else {
      await createTask({ workspaceId, ...payload });
    }
    router.refresh();
    setSaving(false);
    onClose();
  }

  return (
    <motion.div className="fixed inset-0 z-40 flex justify-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <motion.div className="relative w-[400px] bg-white h-full flex flex-col shadow-2xl"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            {/* Title */}
            <input value={form.title} onChange={e => setF("title", e.target.value)}
              placeholder="Título *"
              className="w-full text-[14px] font-medium border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white mb-3" />

            {/* Description toggle + editor */}
            {!showDesc ? (
              <button onClick={() => setShowDesc(true)}
                className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-primary transition-colors">
                <Plus className="h-3.5 w-3.5" /> Agregar descripción
              </button>
            ) : (
              <div>
                <button onClick={() => setShowDesc(false)}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-400 transition-colors mb-1">
                  <X className="h-3 w-3" /> Quitar descripción
                </button>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <RichToolbar targetRef={descRef} />
                  <div
                    ref={descRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-[120px] px-3 py-2 text-[13px] text-gray-700 outline-none focus:ring-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                    onInput={e => setCharCount((e.currentTarget as HTMLDivElement).textContent?.length ?? 0)}
                  />
                  <div className="text-right text-[10px] text-gray-300 px-3 py-1 border-t border-gray-100">
                    {charCount} / 2000 caracteres
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Due date */}
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Fecha y hora de vencimiento
              </label>
              <input type="datetime-local" value={form.dueAt} onChange={e => setF("dueAt", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white" />
            </div>

            {/* Recurring */}
            <div className={cn("rounded-lg border transition-colors", form.recurring ? "border-primary/30 bg-primary/3" : "border-gray-200 bg-gray-50")}>
              <div className="flex items-center justify-between py-2.5 px-3">
                <div className="flex items-center gap-2">
                  <RotateCcw className={cn("h-3.5 w-3.5 transition-colors", form.recurring ? "text-primary" : "text-gray-400")} />
                  <span className="text-[13px] font-medium text-gray-700">Tarea recurrente</span>
                </div>
                <button onClick={() => setF("recurring", !form.recurring)}
                  className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0",
                    form.recurring ? "bg-primary" : "bg-gray-200")}>
                  <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    form.recurring ? "translate-x-4" : "translate-x-0.5")} />
                </button>
              </div>

              <AnimatePresence>
                {form.recurring && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden">
                    <div className="px-3 pb-3 space-y-3 border-t border-primary/10 pt-3">

                      {/* Frecuencia */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Frecuencia</p>
                        <div className="grid grid-cols-4 gap-1">
                          {(["DIARIO","SEMANAL","MENSUAL","ANUAL"] as const).map(f => (
                            <button key={f} onClick={() => setF("recurFreq", f)}
                              className={cn("py-1.5 rounded-lg text-[11px] font-semibold border transition-all",
                                form.recurFreq === f
                                  ? "bg-primary text-white border-primary"
                                  : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
                              {f === "DIARIO" ? "Diario" : f === "SEMANAL" ? "Semanal" : f === "MENSUAL" ? "Mensual" : "Anual"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cada X */}
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-gray-600 shrink-0">Repetir cada</span>
                        <input type="number" min={1} max={99}
                          value={form.recurInterval}
                          onChange={e => setF("recurInterval", Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-[12px] text-center outline-none focus:ring-1 focus:ring-primary" />
                        <span className="text-[12px] text-gray-500">
                          {form.recurFreq === "DIARIO" ? (form.recurInterval === 1 ? "día" : "días")
                            : form.recurFreq === "SEMANAL" ? (form.recurInterval === 1 ? "semana" : "semanas")
                            : form.recurFreq === "MENSUAL" ? (form.recurInterval === 1 ? "mes" : "meses")
                            : (form.recurInterval === 1 ? "año" : "años")}
                        </span>
                      </div>

                      {/* Días de la semana (solo SEMANAL) */}
                      {form.recurFreq === "SEMANAL" && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Días</p>
                          <div className="flex gap-1">
                            {["D","L","M","X","J","V","S"].map((d, i) => {
                              const active = form.recurDays.includes(i);
                              return (
                                <button key={i}
                                  onClick={() => {
                                    const next = active
                                      ? form.recurDays.filter(x => x !== i)
                                      : [...form.recurDays, i].sort();
                                    if (next.length > 0) setForm(f => ({ ...f, recurDays: next }));
                                  }}
                                  className={cn("h-7 w-7 rounded-full text-[11px] font-bold border transition-all",
                                    active ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-400 hover:bg-gray-50")}>
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Termina */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Termina</p>
                        <div className="space-y-2">
                          {(["NUNCA","FECHA","OCURRENCIAS"] as const).map(opt => (
                            <label key={opt} className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="recurEnds" checked={form.recurEnds === opt}
                                onChange={() => setF("recurEnds", opt)}
                                className="accent-primary" />
                              <span className="text-[12px] text-gray-700">
                                {opt === "NUNCA" ? "Nunca" : opt === "FECHA" ? "En fecha" : "Después de"}
                              </span>
                              {opt === "FECHA" && form.recurEnds === "FECHA" && (
                                <input type="date" value={form.recurEndDate}
                                  onChange={e => setF("recurEndDate", e.target.value)}
                                  className="border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-primary ml-1" />
                              )}
                              {opt === "OCURRENCIAS" && form.recurEnds === "OCURRENCIAS" && (
                                <div className="flex items-center gap-1 ml-1">
                                  <input type="number" min={1} max={999}
                                    value={form.recurOccurrences}
                                    onChange={e => setF("recurOccurrences", Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-14 border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] text-center outline-none focus:ring-1 focus:ring-primary" />
                                  <span className="text-[11px] text-gray-500">ocurrencias</span>
                                </div>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Resumen */}
                      <div className="bg-white border border-primary/20 rounded-lg px-3 py-2 text-[11px] text-primary font-medium">
                        {form.recurFreq === "DIARIO" && `Cada ${form.recurInterval === 1 ? "día" : `${form.recurInterval} días`}`}
                        {form.recurFreq === "SEMANAL" && `Cada ${form.recurInterval === 1 ? "semana" : `${form.recurInterval} semanas`}${form.recurDays.length > 0 ? ` · ${form.recurDays.map(d => ["Do","Lu","Ma","Mi","Ju","Vi","Sa"][d]).join(", ")}` : ""}`}
                        {form.recurFreq === "MENSUAL" && `Cada ${form.recurInterval === 1 ? "mes" : `${form.recurInterval} meses`}`}
                        {form.recurFreq === "ANUAL" && `Cada ${form.recurInterval === 1 ? "año" : `${form.recurInterval} años`}`}
                        {form.recurEnds === "FECHA" && form.recurEndDate && ` · hasta ${new Date(form.recurEndDate + "T00:00:00").toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" })}`}
                        {form.recurEnds === "OCURRENCIAS" && ` · ${form.recurOccurrences} veces`}
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Assign to */}
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <User className="h-3 w-3" /> Asignar a
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-[13px] hover:bg-gray-50 transition-colors">
                    {selectedUser ? (
                      <>
                        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                          {initials(selectedUser.name)}
                        </div>
                        <span className="text-gray-800">{selectedUser.name}</span>
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 text-gray-300 shrink-0" />
                        <span className="text-gray-400">Seleccionar usuario…</span>
                      </>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => setF("assignedTo", "")} className="text-xs text-gray-400">Sin asignar</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {users.map(u => (
                    <DropdownMenuItem key={u.id} onClick={() => setF("assignedTo", u.id)} className="text-xs gap-2">
                      <div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                        {initials(u.name)}
                      </div>
                      {u.name}
                      {form.assignedTo === u.id && <Check className="h-3 w-3 ml-auto text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Flag className="h-3 w-3" /> Prioridad
              </label>
              <div className="flex gap-2">
                {(["BAJA","MEDIA","ALTA","URGENTE"] as Priority[]).map(p => (
                  <button key={p} onClick={() => setF("priority", p)}
                    className={cn("flex-1 py-1.5 rounded-lg border text-[11px] font-semibold transition-all",
                      form.priority === p
                        ? p === "URGENTE" ? "bg-red-50 border-red-300 text-red-600"
                          : p === "ALTA" ? "bg-orange-50 border-orange-300 text-orange-600"
                          : p === "MEDIA" ? "bg-yellow-50 border-yellow-300 text-yellow-600"
                          : "bg-gray-100 border-gray-300 text-gray-600"
                        : "border-gray-200 text-gray-400 hover:bg-gray-50")}>
                    {PRIORITY_CFG[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Estado</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn("flex items-center gap-2 border rounded-lg px-3 py-2 text-[13px] w-full hover:opacity-90 transition-opacity",
                    STATUS_CFG[form.status].bg, STATUS_CFG[form.status].border, STATUS_CFG[form.status].color)}>
                    <StatusIcon status={form.status} />
                    {STATUS_CFG[form.status].label}
                    <ChevronDown className="h-3.5 w-3.5 ml-auto opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {(Object.keys(STATUS_CFG) as TaskStatus[]).map(s => (
                    <DropdownMenuItem key={s} onClick={() => setF("status", s)} className="text-xs gap-2">
                      <StatusIcon status={s} />
                      {STATUS_CFG[s].label}
                      {form.status === s && <Check className="h-3 w-3 ml-auto text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Associated contact */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Objetos asociados
                </label>
                <button className="text-[11px] text-primary hover:underline">Asociar a ∨</button>
              </div>
              <div className="text-[11px] text-gray-500 font-semibold mb-1.5">
                Contactos ({selectedLead ? 1 : 0}/10)
              </div>
              {selectedLead && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-2">
                  <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {selectedLead.firstName[0]}{selectedLead.lastName?.[0] ?? ""}
                  </div>
                  <span className="text-[12px] text-gray-800 flex-1">{selectedLead.firstName} {selectedLead.lastName ?? ""}</span>
                  <button onClick={() => { setF("leadId", ""); setLeadSearch(""); }} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {!selectedLead ? (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                  <input value={leadSearch} onChange={e => { setLeadSearch(e.target.value); setShowLeadDrop(true); }}
                    onFocus={() => setShowLeadDrop(true)}
                    placeholder="+ Agregar contacto…"
                    className="w-full border border-dashed border-gray-300 rounded-lg pl-8 pr-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white" />
                  {showLeadDrop && leadSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-[160px] overflow-y-auto">
                      {filteredLeads.length === 0
                        ? <p className="text-xs text-gray-400 p-3">Sin resultados</p>
                        : filteredLeads.map(l => (
                          <button key={l.id} onClick={() => { setF("leadId", l.id); setLeadSearch(""); setShowLeadDrop(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-blue-100 text-[10px] font-bold flex items-center justify-center shrink-0 text-blue-700">
                              {l.firstName[0]}{l.lastName?.[0] ?? ""}
                            </div>
                            <div>
                              <p className="text-[12px] font-medium">{l.firstName} {l.lastName ?? ""}</p>
                              <p className="text-[10px] text-gray-400">{l.phone}</p>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setShowLeadDrop(!showLeadDrop)}
                  className="text-[12px] text-primary hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Agregar
                </button>
              )}
            </div>
          </div>

          {/* Metadata */}
          {isEdit && task && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
              <div className="space-y-1 text-[11px] text-gray-400">
                <p><span className="font-medium">Creado por:</span> Sistema</p>
                <p><span className="font-medium">Creado el:</span> {new Date(task.createdAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}</p>
                <p><span className="font-medium">Última actualización:</span> {new Date(task.updatedAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-gray-100 bg-white shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button size="sm" disabled={!form.title.trim() || saving} onClick={handleSave} className="flex-1">
            {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear tarea"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Delete Confirm ────────────────────────────────────────
function DeleteConfirm({ task, onConfirm, onCancel }: { task: Task; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}>
      <motion.div className="bg-white rounded-2xl shadow-2xl p-6 w-[360px]"
        initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Eliminar tarea</h3>
        <p className="text-[13px] text-gray-500 mb-5">
          ¿Eliminar <span className="font-medium text-gray-800">&quot;{task.title}&quot;</span>? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">Cancelar</Button>
          <Button size="sm" onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 border-red-600">Eliminar</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main TasksClient ──────────────────────────────────────
export function TasksClient({ tasks, leads, users, workspaceId }: {
  tasks: Task[]; leads: Lead[]; users: WUser[]; workspaceId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "">("");
  const [filterDue, setFilterDue] = useState<"" | "today" | "week" | "month" | "overdue" | "none">("");
  const [sortField, setSortField] = useState<"dueAt" | "title" | "priority" | "status" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [panel, setPanel] = useState<Task | null | "new">(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  // Tab filter
  let filtered = tasks.filter(t => {
    if (tab === "today") return t.dueAt && new Date(t.dueAt) >= todayStart && new Date(t.dueAt) < todayEnd;
    if (tab === "overdue") return t.dueAt && new Date(t.dueAt) < now && t.status !== "COMPLETADA";
    if (tab === "upcoming") return t.dueAt && new Date(t.dueAt) > todayEnd && t.status !== "COMPLETADA";
    return true;
  });

  // Additional filters
  if (filterAssignee) filtered = filtered.filter(t => t.assignedTo === filterAssignee);
  if (filterStatus)   filtered = filtered.filter(t => t.status === filterStatus);
  if (filterDue === "today")   filtered = filtered.filter(t => t.dueAt && new Date(t.dueAt) >= todayStart && new Date(t.dueAt) < todayEnd);
  if (filterDue === "overdue") filtered = filtered.filter(t => t.dueAt && new Date(t.dueAt) < now && t.status !== "COMPLETADA");
  if (filterDue === "none")    filtered = filtered.filter(t => !t.dueAt);
  if (filterDue === "week") {
    const weekEnd = new Date(todayStart.getTime() + 7 * 86_400_000);
    filtered = filtered.filter(t => t.dueAt && new Date(t.dueAt) >= todayStart && new Date(t.dueAt) < weekEnd);
  }
  if (filterDue === "month") {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    filtered = filtered.filter(t => t.dueAt && new Date(t.dueAt) >= todayStart && new Date(t.dueAt) < monthEnd);
  }
  if (search) filtered = filtered.filter(t => `${t.title} ${t.description ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  // Sort
  filtered = [...filtered].sort((a, b) => {
    let va: string | number, vb: string | number;
    if (sortField === "dueAt") { va = a.dueAt ?? ""; vb = b.dueAt ?? ""; }
    else if (sortField === "priority") {
      const order = { URGENTE: 4, ALTA: 3, MEDIA: 2, BAJA: 1 };
      va = order[a.priority]; vb = order[b.priority];
    }
    else if (sortField === "status") { va = a.status; vb = b.status; }
    else if (sortField === "title") { va = a.title.toLowerCase(); vb = b.title.toLowerCase(); }
    else { va = a.createdAt; vb = b.createdAt; }
    return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  // Tab counts
  const counts = {
    all: tasks.length,
    today: tasks.filter(t => t.dueAt && new Date(t.dueAt) >= todayStart && new Date(t.dueAt) < todayEnd).length,
    overdue: tasks.filter(t => t.dueAt && new Date(t.dueAt) < now && t.status !== "COMPLETADA").length,
    upcoming: tasks.filter(t => t.dueAt && new Date(t.dueAt) > todayEnd && t.status !== "COMPLETADA").length,
  };

  const activeFilters = [filterAssignee, filterStatus, filterDue].filter(Boolean).length;

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(t => t.id)));
  }

  async function handleToggleStatus(t: Task) {
    await toggleTaskStatus(t.id, t.status);
    router.refresh();
  }

  async function handleDelete(t: Task) {
    await deleteTask(t.id);
    setDeleting(null);
    router.refresh();
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-bold text-gray-900">Tareas</h1>
          {tasks.length > 0 && (
            <span className="text-[12px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setPanel("new")} className="h-8 gap-1.5 text-[12px]">
            <Plus className="h-3.5 w-3.5" /> Agregar tarea
          </Button>
          <button className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-gray-100 px-6">
        {([
          ["all", "Todas", counts.all],
          ["today", "Vence hoy", counts.today],
          ["overdue", "Vencidas", counts.overdue],
          ["upcoming", "Próximas", counts.upcoming],
        ] as [TabKey, string, number][]).map(([k, l, c]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors",
              tab === k ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700")}>
            <LayoutList className="h-3.5 w-3.5" />
            {l}
            {c > 0 && <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
              tab === k ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500")}>{c}</span>}
          </button>
        ))}
        <button className="flex items-center gap-1 px-4 py-3 text-[13px] text-gray-400 hover:text-gray-600 transition-colors ml-1">
          <Plus className="h-3.5 w-3.5" /> Lista
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 border-b border-gray-100 flex-wrap">
        {/* Assignee */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex items-center gap-1.5 text-[12px] border rounded-lg px-3 py-1.5 transition-colors hover:bg-gray-50",
              filterAssignee ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600")}>
              <User className="h-3.5 w-3.5" />
              Asignado: {filterAssignee ? (users.find(u => u.id === filterAssignee)?.name.split(" ")[0] ?? "Todos") : "Todos"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilterAssignee("")} className="text-xs">Todos</DropdownMenuItem>
            <DropdownMenuSeparator />
            {users.map(u => (
              <DropdownMenuItem key={u.id} onClick={() => setFilterAssignee(u.id)} className="text-xs gap-2">
                <div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">{initials(u.name)}</div>
                {u.name}
                {filterAssignee === u.id && <Check className="h-3 w-3 ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex items-center gap-1.5 text-[12px] border rounded-lg px-3 py-1.5 transition-colors hover:bg-gray-50",
              filterStatus ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600")}>
              <Check className="h-3.5 w-3.5" />
              Estado: {filterStatus ? STATUS_CFG[filterStatus].label : "Todos"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilterStatus("")} className="text-xs">Todos</DropdownMenuItem>
            <DropdownMenuSeparator />
            {(Object.keys(STATUS_CFG) as TaskStatus[]).map(s => (
              <DropdownMenuItem key={s} onClick={() => setFilterStatus(s)} className="text-xs gap-2">
                <StatusIcon status={s} />
                {STATUS_CFG[s].label}
                {filterStatus === s && <Check className="h-3 w-3 ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Due Date */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex items-center gap-1.5 text-[12px] border rounded-lg px-3 py-1.5 transition-colors hover:bg-gray-50",
              filterDue ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600")}>
              <Calendar className="h-3.5 w-3.5" />
              Vencimiento: {filterDue === "today" ? "Hoy" : filterDue === "week" ? "Esta semana" : filterDue === "month" ? "Este mes" : filterDue === "overdue" ? "Vencidas" : filterDue === "none" ? "Sin fecha" : "Todos"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {[["", "Todos"],["today","Hoy"],["week","Esta semana"],["month","Este mes"],["overdue","Vencidas"],["none","Sin fecha"]].map(([v, l]) => (
              <DropdownMenuItem key={v} onClick={() => setFilterDue(v as typeof filterDue)} className="text-xs">
                {l}
                {filterDue === v && <Check className="h-3 w-3 ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Advanced */}
        <button className="flex items-center gap-1.5 text-[12px] border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros avanzados
        </button>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex items-center gap-1.5 text-[12px] border rounded-lg px-3 py-1.5 transition-colors hover:bg-gray-50",
              sortField !== "createdAt" || sortDir !== "desc" ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600")}>
              <ArrowUpDown className="h-3.5 w-3.5" />
              Ordenar {activeFilters > 0 ? `(${activeFilters})` : ""}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {([["createdAt","Fecha de creación"],["dueAt","Fecha vencimiento"],["title","Título"],["priority","Prioridad"],["status","Estado"]] as [typeof sortField, string][]).map(([f, l]) => (
              <DropdownMenuItem key={f} onClick={() => toggleSort(f)} className="text-xs justify-between">
                {l}
                {sortField === f && <span className="text-primary text-[10px] ml-2">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Reset */}
        {(filterAssignee || filterStatus || filterDue || search) && (
          <button onClick={() => { setFilterAssignee(""); setFilterStatus(""); setFilterDue(""); setSearch(""); }}
            className="text-[11px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
            <X className="h-3 w-3" /> Limpiar
          </button>
        )}

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tarea..."
            className="pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-primary bg-white w-[200px]" />
        </div>

        {/* Manage fields */}
        <button className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-700 transition-colors">
          <Settings2 className="h-3.5 w-3.5" /> Gestionar columnas
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <ListTodo className="h-12 w-12 opacity-15" />
            <p className="text-[14px] font-medium text-gray-400">Sin tareas</p>
            <Button variant="outline" size="sm" onClick={() => setPanel("new")}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Crear primera tarea
            </Button>
          </div>
        ) : (
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
              <tr>
                <th className="w-8 px-4 py-3">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-primary cursor-pointer" />
                </th>
                <th className="w-8" />
                <th className="text-left text-[11px] font-semibold text-gray-500 py-3 pr-4 cursor-pointer hover:text-gray-800" onClick={() => toggleSort("title")}>
                  Título {sortField === "title" && <span className="text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
                <th className="text-left text-[11px] font-semibold text-gray-500 py-3 pr-4">Descripción</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 py-3 pr-4">Contacto asociado</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 py-3 pr-4">Asignado</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 py-3 pr-4 cursor-pointer hover:text-gray-800" onClick={() => toggleSort("dueAt")}>
                  Vencimiento {sortField === "dueAt" && <span className="text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
                <th className="text-left text-[11px] font-semibold text-gray-500 py-3 pr-4 cursor-pointer hover:text-gray-800" onClick={() => toggleSort("priority")}>
                  Prioridad {sortField === "priority" && <span className="text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
                <th className="text-left text-[11px] font-semibold text-gray-500 py-3 pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const isOverdue = t.dueAt && new Date(t.dueAt) < now && t.status !== "COMPLETADA";
                const pCfg = PRIORITY_CFG[t.priority];
                return (
                  <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className={cn("border-b border-gray-50 hover:bg-gray-50/60 transition-colors group",
                      selectedIds.has(t.id) && "bg-primary/3")}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 accent-primary cursor-pointer" />
                    </td>
                    {/* Status icon */}
                    <td className="pr-2 py-3">
                      <StatusIcon status={t.status} onClick={() => handleToggleStatus(t)} />
                    </td>
                    {/* Title */}
                    <td className="py-3 pr-4">
                      <button onClick={() => setPanel(t)} className="text-left font-semibold text-gray-900 hover:text-primary transition-colors">
                        <span className={cn(t.status === "COMPLETADA" && "line-through text-gray-400")}>{t.title}</span>
                      </button>
                    </td>
                    {/* Description */}
                    <td className="py-3 pr-4 max-w-[200px]">
                      {t.description ? (
                        <p className="text-gray-500 truncate text-[11px]"
                          dangerouslySetInnerHTML={{ __html: t.description.replace(/<[^>]*>/g, "") }} />
                      ) : <span className="text-gray-200">—</span>}
                    </td>
                    {/* Lead */}
                    <td className="py-3 pr-4">
                      {t.lead ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                            {t.lead.firstName[0]}{t.lead.lastName?.[0] ?? ""}
                          </div>
                          <span className="text-gray-700 text-[11px]">{leadName(t.lead)}</span>
                        </div>
                      ) : <span className="text-gray-200">—</span>}
                    </td>
                    {/* Assignee */}
                    <td className="py-3 pr-4">
                      {t.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-6 w-6 rounded-full bg-violet-100 text-violet-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                            {initials(t.assignee.name)}
                          </div>
                        </div>
                      ) : <span className="text-gray-200">—</span>}
                    </td>
                    {/* Due date */}
                    <td className="py-3 pr-4">
                      {t.dueAt ? (
                        <span className={cn("text-[11px]", isOverdue ? "text-red-500 font-semibold" : "text-gray-600")}>
                          {fmtDue(t.dueAt)}
                        </span>
                      ) : <span className="text-gray-200">—</span>}
                    </td>
                    {/* Priority */}
                    <td className="py-3 pr-4">
                      <span className={cn("text-[11px] font-semibold flex items-center gap-1", pCfg.color)}>
                        <Flag className="h-3 w-3" />
                        {pCfg.label}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="py-3 pr-6">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setPanel(t)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 transition-colors">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button onClick={() => setDeleting(t)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination footer */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-6 py-2.5 border-t border-gray-100 bg-white text-[11px] text-gray-400">
          <span>Página 1 de 1</span>
          <span>{filtered.length} tarea{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Side panel */}
      <AnimatePresence>
        {panel !== null && (
          <TaskPanel
            key="panel"
            task={panel === "new" ? null : panel}
            leads={leads}
            users={users}
            workspaceId={workspaceId}
            onClose={() => setPanel(null)}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleting && (
          <DeleteConfirm
            key="delete"
            task={deleting}
            onConfirm={() => handleDelete(deleting)}
            onCancel={() => setDeleting(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
