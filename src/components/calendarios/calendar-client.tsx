"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Plus, X, Calendar, Phone,
  Video, Car, CheckSquare, MessageSquare, MapPin, Clock,
  Search, ChevronDown, Trash2, Edit2,
  Link2, User, Check, Settings, Bell, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createAppointmentCalendar, updateAppointmentCalendar,
  updateApptStatus, deleteAppointment,
} from "@/app/actions/appointments";

// ── Types ─────────────────────────────────────────────────
type ApptType = "VISITA_DEALER" | "LLAMADA" | "VIDEO_LLAMADA" | "TEST_DRIVE" | "ENTREGA" | "SEGUIMIENTO";
type ApptStatus = "AGENDADA" | "CONFIRMADA" | "COMPLETADA" | "CANCELADA" | "NO_SHOW";
type CalView = "day" | "week" | "month";

type Appointment = {
  id: string;
  title: string;
  type: ApptType;
  status: ApptStatus;
  startAt: string;
  endAt: string;
  notes: string | null;
  location: string | null;
  meetingUrl: string | null;
  assignedTo: string | null;
  leadId: string | null;
  leadName: string | null;
  leadPhone: string | null;
};

type Lead = { id: string; firstName: string; lastName: string | null; phone: string };
type WorkspaceUser = { id: string; name: string };

type CalSettings = {
  workingDays: boolean[];        // [Mon,Tue,Wed,Thu,Fri,Sat,Sun]
  workStart: number;             // hour 0-23
  workEnd: number;
  defaultDuration: number;       // minutes
  defaultType: ApptType;
  defaultView: CalView;
  autoConfirm: boolean;
  showWeekend: boolean;
};

const DEFAULT_SETTINGS: CalSettings = {
  workingDays: [true, true, true, true, true, false, false],
  workStart: 8,
  workEnd: 19,
  defaultDuration: 60,
  defaultType: "VISITA_DEALER",
  defaultView: "week",
  autoConfirm: false,
  showWeekend: true,
};

// ── Constants ─────────────────────────────────────────────
const HOUR_HEIGHT = 56;

const TYPE_META: Record<ApptType, { label: string; Icon: React.ElementType; color: string; bg: string; border: string; dot: string }> = {
  VISITA_DEALER: { label: "Visita Dealer",  Icon: Car,           color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-300",  dot: "bg-blue-500" },
  LLAMADA:       { label: "Llamada",         Icon: Phone,         color: "text-green-700",  bg: "bg-green-50",  border: "border-green-300", dot: "bg-green-500" },
  VIDEO_LLAMADA: { label: "Video Llamada",   Icon: Video,         color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-300",dot: "bg-violet-500" },
  TEST_DRIVE:    { label: "Test Drive",      Icon: Car,           color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300",dot: "bg-orange-500" },
  ENTREGA:       { label: "Entrega",         Icon: CheckSquare,   color: "text-teal-700",   bg: "bg-teal-50",   border: "border-teal-300",  dot: "bg-teal-500" },
  SEGUIMIENTO:   { label: "Seguimiento",     Icon: MessageSquare, color: "text-gray-600",   bg: "bg-gray-100",  border: "border-gray-300",  dot: "bg-gray-400" },
};

const STATUS_META: Record<ApptStatus, { label: string; cls: string; dot: string }> = {
  AGENDADA:   { label: "Agendada",   cls: "text-blue-600 bg-blue-50 border-blue-200",    dot: "bg-blue-500" },
  CONFIRMADA: { label: "Confirmada", cls: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-500" },
  COMPLETADA: { label: "Completada", cls: "text-gray-600 bg-gray-100 border-gray-200",   dot: "bg-gray-400" },
  CANCELADA:  { label: "Cancelada",  cls: "text-red-600 bg-red-50 border-red-200",       dot: "bg-red-500" },
  NO_SHOW:    { label: "No Show",    cls: "text-orange-600 bg-orange-50 border-orange-200", dot: "bg-orange-500" },
};

const VIEW_LABELS: Record<CalView, string> = { day: "Day view", week: "Week view", month: "Month view" };
const APPT_TYPES: ApptType[] = ["VISITA_DEALER", "LLAMADA", "VIDEO_LLAMADA", "TEST_DRIVE", "ENTREGA", "SEGUIMIENTO"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

// ── Settings hook ─────────────────────────────────────────
function useCalSettings(workspaceId: string) {
  const key = `cal_settings_${workspaceId}`;
  const [settings, setSettings] = useState<CalSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {}
  }, [key]);

  const save = useCallback((patch: Partial<CalSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);

  return { settings, save };
}

// ── Helpers ───────────────────────────────────────────────
function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function getWeekDays(start: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}
function fmtHour(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { weekday: "short", month: "short", day: "numeric" });
}
function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function addMinutes(iso: string, mins: number) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + mins);
  return toLocalISO(d);
}

// ── Mini Calendar ─────────────────────────────────────────
function MiniCalendar({ anchor, today, calView, onDayClick }: {
  anchor: Date; today: Date; calView: CalView; onDayClick: (d: Date) => void;
}) {
  const [miniY, setMiniY] = useState(anchor.getFullYear());
  const [miniM, setMiniM] = useState(anchor.getMonth());

  useEffect(() => { setMiniY(anchor.getFullYear()); setMiniM(anchor.getMonth()); }, [anchor]);

  const firstDay = new Date(miniY, miniM, 1);
  const gridStart = new Date(firstDay);
  const fd = firstDay.getDay();
  gridStart.setDate(gridStart.getDate() - (fd === 0 ? 6 : fd - 1));

  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(d.getDate() + i); return d;
  });
  const rows = cells[34].getMonth() === miniM ? 42 : 35;

  const weekEnd = calView === "week" ? (() => { const d = new Date(anchor); d.setDate(d.getDate()+6); return d; })() : null;

  function prevMiniMonth() {
    if (miniM === 0) { setMiniM(11); setMiniY(y => y-1); }
    else setMiniM(m => m-1);
  }
  function nextMiniMonth() {
    if (miniM === 11) { setMiniM(0); setMiniY(y => y+1); }
    else setMiniM(m => m+1);
  }

  return (
    <div className="px-3 pt-3 pb-2 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMiniMonth} className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 transition-colors">
          <ChevronLeft className="h-3 w-3" />
        </button>
        <span className="text-[11px] font-semibold text-gray-700 capitalize">
          {MONTHS_ES[miniM].slice(0,3)} {miniY}
        </span>
        <button onClick={nextMiniMonth} className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 transition-colors">
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-0.5">
        {["L","M","X","J","V","S","D"].map(d => (
          <div key={d} className="text-center text-[9px] font-medium text-gray-400 h-4 flex items-center justify-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.slice(0, rows).map((day, i) => {
          const inCurrMonth = day.getMonth() === miniM;
          const isToday = isSameDay(day, today);
          const isDaySelected = calView === "day" && isSameDay(day, anchor);
          const inWeek = calView === "week" && weekEnd && day >= anchor && day <= weekEnd;
          const isWkStart = calView === "week" && isSameDay(day, anchor);
          const isWkEnd = calView === "week" && weekEnd && isSameDay(day, weekEnd);

          return (
            <button key={i} onClick={() => onDayClick(day)}
              className={cn(
                "h-6 flex items-center justify-center text-[10px] transition-colors",
                inWeek && !isWkStart && !isWkEnd ? "bg-primary/8" : "",
                isWkStart ? "bg-primary/8 rounded-l-full" : "",
                isWkEnd ? "bg-primary/8 rounded-r-full" : "",
              )}>
              <span className={cn(
                "h-5 w-5 flex items-center justify-center rounded-full",
                isToday ? "bg-primary text-white font-bold" :
                isDaySelected ? "bg-primary/15 text-primary font-semibold" :
                inCurrMonth ? "text-gray-700 hover:bg-gray-100" : "text-gray-300",
              )}>
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────
function CalendarSidebar({ appointments, anchor, today, calView, activeTypes, onTypeToggle, onDayClick }: {
  appointments: Appointment[]; anchor: Date; today: Date; calView: CalView;
  activeTypes: Set<ApptType>; onTypeToggle: (t: ApptType) => void;
  onDayClick: (d: Date) => void;
}) {
  const upcoming = appointments
    .filter(a => a.startAt >= today.toISOString() && a.status !== "CANCELADA")
    .slice(0, 4);

  return (
    <div className="w-[200px] shrink-0 border-r border-gray-100 flex flex-col overflow-y-auto bg-white">
      <MiniCalendar anchor={anchor} today={today} calView={calView} onDayClick={onDayClick} />

      {/* Type filters */}
      <div className="border-t border-gray-100 px-3 py-3">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tipo de cita</p>
        <div className="space-y-0.5">
          {APPT_TYPES.map(t => {
            const meta = TYPE_META[t];
            const count = appointments.filter(a => a.type === t).length;
            const active = activeTypes.has(t);
            return (
              <button key={t} onClick={() => onTypeToggle(t)}
                className="w-full flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-gray-50 transition-colors group">
                <div className={cn(
                  "h-3.5 w-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                  active ? `${meta.border} ${meta.bg}` : "border-gray-300 bg-white"
                )}>
                  {active && <Check className={cn("h-2 w-2", meta.color)} strokeWidth={3} />}
                </div>
                <span className={cn("text-[11px] flex-1 text-left leading-tight", active ? "text-gray-800 font-medium" : "text-gray-500")}>
                  {meta.label}
                </span>
                {count > 0 && <span className="text-[9px] text-gray-400 font-medium">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-3 flex-1">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Próximas</p>
          <div className="space-y-2">
            {upcoming.map(a => {
              const meta = TYPE_META[a.type];
              return (
                <div key={a.id} className={cn("rounded-lg p-2 border", meta.bg, meta.border)}>
                  <p className={cn("text-[11px] font-semibold leading-tight truncate", meta.color)}>{a.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{fmtDate(a.startAt)}</p>
                  <p className="text-[10px] text-gray-400">{fmtTime(a.startAt)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Appointment Block ─────────────────────────────────────
function ApptBlock({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const start = new Date(appt.startAt);
  const end = new Date(appt.endAt);
  const top = (start.getHours() + start.getMinutes() / 60) * HOUR_HEIGHT;
  const durationH = (end.getTime() - start.getTime()) / 3_600_000;
  const height = Math.max(durationH * HOUR_HEIGHT, 22);
  const meta = TYPE_META[appt.type];
  const Icon = meta.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ top, height, left: 2, right: 2 }}
      className={cn("absolute rounded-md border px-1.5 py-1 cursor-pointer overflow-hidden hover:shadow-md transition-shadow z-10", meta.bg, meta.border)}>
      <p className={cn("text-[11px] font-semibold leading-tight truncate", meta.color)}>{appt.title}</p>
      {height > 36 && (
        <p className="text-[10px] text-gray-500 leading-tight mt-0.5 truncate flex items-center gap-0.5">
          <Icon className="h-2.5 w-2.5 shrink-0" />
          {fmtTime(appt.startAt)} · {appt.leadName ?? "Sin contacto"}
        </p>
      )}
    </motion.div>
  );
}

// ── Time Grid (Day + Week) ────────────────────────────────
function TimeGrid({ appointments, days, today, settings, onSlotClick, onApptClick }: {
  appointments: Appointment[]; days: Date[]; today: Date; settings: CalSettings;
  onSlotClick: (dt: string) => void; onApptClick: (a: Appointment) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowTop, setNowTop] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setNowTop((now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT);
    };
    update();
    const t = setInterval(update, 60_000);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (settings.workStart - 1) * HOUR_HEIGHT);
    }
    return () => clearInterval(t);
  }, [settings.workStart]);

  const todayInView = days.some(d => isSameDay(d, today));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="flex border-b border-gray-100 bg-white sticky top-0 z-20">
        <div className="w-14 shrink-0" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className="flex-1 text-center py-2.5 border-l border-gray-100">
              <p className={cn("text-[10px] font-semibold uppercase tracking-wider", isToday ? "text-primary" : "text-gray-400")}>
                {DAYS_ES[day.getDay()]}
              </p>
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center mx-auto mt-0.5 text-[13px] font-bold", isToday ? "bg-primary text-white" : "text-gray-800")}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex relative">
          {/* Hour labels */}
          <div className="w-14 shrink-0">
            {HOURS.map(h => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="flex items-start justify-end pr-2 pt-1">
                <span className="text-[10px] text-gray-400 font-medium">{h === 0 ? "" : fmtHour(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => {
            const dayAppts = appointments.filter(a => isSameDay(new Date(a.startAt), day));
            const isToday = isSameDay(day, today);
            return (
              <div key={di} className="flex-1 relative border-l border-gray-100" style={{ height: HOUR_HEIGHT * 24 }}>
                {HOURS.map(h => {
                  const isWorkHour = h >= settings.workStart && h < settings.workEnd;
                  return (
                    <div key={h} style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      className={cn(
                        "absolute left-0 right-0 border-t border-gray-100 cursor-pointer transition-colors",
                        isWorkHour ? "hover:bg-primary/3" : "bg-gray-50/60 hover:bg-gray-50",
                      )}
                      onClick={() => {
                        const d = new Date(day); d.setHours(h, 0, 0, 0);
                        onSlotClick(toLocalISO(d));
                      }} />
                  );
                })}
                {/* Work hours labels */}
                <div style={{ top: settings.workStart * HOUR_HEIGHT, height: (settings.workEnd - settings.workStart) * HOUR_HEIGHT }}
                  className="absolute left-0 right-0 pointer-events-none" />
                {/* Now line */}
                {todayInView && isToday && (
                  <div style={{ top: nowTop }} className="absolute left-0 right-0 z-20 pointer-events-none">
                    <div className="h-px bg-red-500 relative">
                      <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                    </div>
                  </div>
                )}
                {dayAppts.map(a => <ApptBlock key={a.id} appt={a} onClick={() => onApptClick(a)} />)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Month View ────────────────────────────────────────────
function MonthView({ appointments, anchor, today, onDayClick, onApptClick }: {
  appointments: Appointment[]; anchor: Date; today: Date;
  onDayClick: (d: Date) => void; onApptClick: (a: Appointment) => void;
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(firstDay);
  const fd = firstDay.getDay();
  gridStart.setDate(gridStart.getDate() - (fd === 0 ? 6 : fd - 1));
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(d.getDate() + i); return d;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAYS_WEEK.map(d => (
          <div key={d} className="text-center py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7" style={{ gridTemplateRows: "repeat(6, minmax(0, 1fr))" }}>
        {cells.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);
          const dayAppts = appointments.filter(a => isSameDay(new Date(a.startAt), day));
          const visible = dayAppts.slice(0, 3);
          const overflow = dayAppts.length - visible.length;
          return (
            <div key={idx} onClick={() => onDayClick(day)}
              className={cn("border-b border-r border-gray-100 p-1.5 cursor-pointer hover:bg-gray-50/60 transition-colors overflow-hidden min-h-0", !isCurrentMonth && "bg-gray-50/40")}>
              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[12px] font-semibold mb-1",
                isToday ? "bg-primary text-white" : isCurrentMonth ? "text-gray-800" : "text-gray-300")}>
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {visible.map(a => {
                  const meta = TYPE_META[a.type];
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      onClick={e => { e.stopPropagation(); onApptClick(a); }}
                      className={cn("rounded px-1 py-0.5 text-[10px] font-medium leading-tight truncate cursor-pointer hover:opacity-80 transition-opacity", meta.bg, meta.color)}>
                      {fmtTime(a.startAt).replace(" AM","am").replace(" PM","pm")} {a.title}
                    </motion.div>
                  );
                })}
                {overflow > 0 && <p className="text-[10px] text-gray-400 font-medium pl-1">+{overflow} más</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Appointment Modal ─────────────────────────────────────
function ApptModal({ initial, leads, users, workspaceId, settings, onClose }: {
  initial: { startAt?: string; appt?: Appointment } | null;
  leads: Lead[]; users: WorkspaceUser[]; workspaceId: string;
  settings: CalSettings; onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [showLeadDrop, setShowLeadDrop] = useState(false);
  const isEdit = !!initial?.appt;
  const appt = initial?.appt;

  const defaultStart = initial?.startAt ?? toLocalISO(new Date());
  const defaultEnd = addMinutes(defaultStart, settings.defaultDuration);

  const [form, setForm] = useState({
    title: appt?.title ?? "",
    type: (appt?.type ?? settings.defaultType) as ApptType,
    startAt: appt?.startAt ? toLocalISO(new Date(appt.startAt)) : defaultStart,
    endAt: appt?.endAt ? toLocalISO(new Date(appt.endAt)) : defaultEnd,
    notes: appt?.notes ?? "",
    location: appt?.location ?? "",
    meetingUrl: appt?.meetingUrl ?? "",
    leadId: appt?.leadId ?? "",
    assignedTo: appt?.assignedTo ?? "",
  });

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Auto-adjust end time when start changes
  useEffect(() => {
    if (!isEdit) setF("endAt", addMinutes(form.startAt, settings.defaultDuration));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startAt]);

  const selectedLead = leads.find(l => l.id === form.leadId);
  const filteredLeads = leads.filter(l =>
    `${l.firstName} ${l.lastName ?? ""} ${l.phone}`.toLowerCase().includes(leadSearch.toLowerCase())
  ).slice(0, 6);

  async function handleSave() {
    if (!form.title || !form.startAt || !form.endAt) return;
    setSaving(true);
    const payload = {
      title: form.title, type: form.type as ApptType,
      startAt: form.startAt, endAt: form.endAt,
      notes: form.notes || null, location: form.location || null,
      meetingUrl: form.meetingUrl || null,
      leadId: form.leadId || null, assignedTo: form.assignedTo || null,
    };
    if (isEdit && appt) await updateAppointmentCalendar(appt.id, payload);
    else await createAppointmentCalendar({ workspaceId, ...payload });
    router.refresh(); setSaving(false); onClose();
  }

  async function handleDelete() {
    if (!appt) return;
    setDeleting(true);
    await deleteAppointment(appt.id);
    router.refresh(); setDeleting(false); onClose();
  }

  const selectedUser = users.find(u => u.id === form.assignedTo);

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] overflow-hidden max-h-[90vh] flex flex-col"
          initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 8 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 className="text-[15px] font-semibold">{isEdit ? "Editar cita" : "Nueva cita"}</h2>
            <div className="flex items-center gap-1.5">
              {isEdit && (
                <button onClick={handleDelete} disabled={deleting}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* Title */}
            <input value={form.title} onChange={e => setF("title", e.target.value)}
              placeholder="Título de la cita *" autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white" />

            {/* Type chips */}
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Tipo</label>
              <div className="grid grid-cols-3 gap-1.5">
                {APPT_TYPES.map(t => {
                  const m = TYPE_META[t]; const Icon = m.Icon;
                  return (
                    <button key={t} onClick={() => setF("type", t)}
                      className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all",
                        form.type === t ? cn(m.bg, m.border, m.color) : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
                      <Icon className="h-3 w-3 shrink-0" />{m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Inicio *</label>
                <input type="datetime-local" value={form.startAt} onChange={e => setF("startAt", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Fin *</label>
                <input type="datetime-local" value={form.endAt} onChange={e => setF("endAt", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white" />
              </div>
            </div>

            {/* Contact */}
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Contacto</label>
              {selectedLead ? (
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {selectedLead.firstName[0]}{selectedLead.lastName?.[0] ?? ""}
                  </div>
                  <span className="text-[12px] flex-1 text-gray-800">{selectedLead.firstName} {selectedLead.lastName ?? ""}</span>
                  <span className="text-[10px] text-gray-400">{selectedLead.phone}</span>
                  <button onClick={() => { setF("leadId", ""); setLeadSearch(""); }} className="text-gray-400 hover:text-gray-600 ml-1">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                  <input value={leadSearch} onChange={e => { setLeadSearch(e.target.value); setShowLeadDrop(true); }}
                    onFocus={() => setShowLeadDrop(true)}
                    placeholder="Buscar contacto…"
                    className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white" />
                  {showLeadDrop && leadSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-[160px] overflow-y-auto">
                      {filteredLeads.length === 0
                        ? <p className="text-xs text-gray-400 p-3">Sin resultados</p>
                        : filteredLeads.map(l => (
                          <button key={l.id} onClick={() => { setF("leadId", l.id); setLeadSearch(""); setShowLeadDrop(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl">
                            <div className="h-6 w-6 rounded-full bg-gray-100 text-[10px] font-bold flex items-center justify-center shrink-0">
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
              )}
            </div>

            {/* Assigned to */}
            {users.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Asignado a</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors">
                      <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className={selectedUser ? "text-gray-800" : "text-gray-400"}>
                        {selectedUser?.name ?? "Seleccionar vendedor…"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem onClick={() => setF("assignedTo", "")} className="text-xs text-gray-400">
                      Sin asignar
                    </DropdownMenuItem>
                    {users.map(u => (
                      <DropdownMenuItem key={u.id} onClick={() => setF("assignedTo", u.id)} className="text-xs gap-2">
                        <div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                          {u.name[0]}
                        </div>
                        {u.name}
                        {form.assignedTo === u.id && <span className="ml-auto text-primary">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Location / Meeting URL */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" /> Ubicación
                </label>
                <input value={form.location} onChange={e => setF("location", e.target.value)}
                  placeholder="Dirección…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Link2 className="h-2.5 w-2.5" /> URL de reunión
                </label>
                <input value={form.meetingUrl} onChange={e => setF("meetingUrl", e.target.value)}
                  placeholder="meet.google.com/…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Notas</label>
              <textarea value={form.notes} onChange={e => setF("notes", e.target.value)}
                rows={2} placeholder="Notas adicionales…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white resize-none" />
            </div>
          </div>

          <div className="flex justify-end gap-2 px-5 pb-5 shrink-0">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={!form.title || saving} onClick={handleSave}>
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cita"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Appointment Detail ────────────────────────────────────
function ApptDetail({ appt, users, onEdit, onClose }: {
  appt: Appointment; users: WorkspaceUser[]; onEdit: () => void; onClose: () => void;
}) {
  const router = useRouter();
  const meta = TYPE_META[appt.type];
  const Icon = meta.Icon;
  const assignedUser = users.find(u => u.id === appt.assignedTo);

  async function changeStatus(status: ApptStatus) {
    await updateApptStatus(appt.id, status);
    router.refresh(); onClose();
  }

  return (
    <motion.div className="fixed inset-0 z-40 flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-white rounded-2xl shadow-2xl w-[340px] overflow-hidden"
        initial={{ scale: 0.95, y: 6 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={e => e.stopPropagation()}>

        <div className={cn("h-1.5 w-full", meta.bg, `border-b ${meta.border}`)} />

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", meta.bg)}>
                <Icon className={cn("h-4 w-4", meta.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 leading-tight">{appt.title}</p>
                <p className={cn("text-[10px] font-medium", meta.color)}>{meta.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onEdit} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-[12px] text-gray-600">
              <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span>{fmtDate(appt.startAt)} · {fmtTime(appt.startAt)} – {fmtTime(appt.endAt)}</span>
            </div>
            {appt.leadName && (
              <div className="flex items-center gap-2 text-[12px] text-gray-600">
                <div className="h-4 w-4 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-[8px] font-bold text-gray-500">
                  {appt.leadName[0]}
                </div>
                <span>{appt.leadName}</span>
                {appt.leadPhone && <span className="text-gray-400 text-[11px]">· {appt.leadPhone}</span>}
              </div>
            )}
            {assignedUser && (
              <div className="flex items-center gap-2 text-[12px] text-gray-600">
                <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span>{assignedUser.name}</span>
              </div>
            )}
            {appt.location && (
              <div className="flex items-center gap-2 text-[12px] text-gray-600">
                <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{appt.location}</span>
              </div>
            )}
            {appt.meetingUrl && (
              <div className="flex items-center gap-2 text-[12px]">
                <Link2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <a href={appt.meetingUrl} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline truncate">{appt.meetingUrl}</a>
              </div>
            )}
            {appt.notes && (
              <p className="text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">{appt.notes}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className={cn("text-[10px] font-semibold rounded-full px-2.5 py-1 border", STATUS_META[appt.status].cls)}>
              {STATUS_META[appt.status].label}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-[11px] text-gray-500 hover:text-primary flex items-center gap-0.5 ml-auto transition-colors">
                  Cambiar <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(STATUS_META) as ApptStatus[]).map(s => (
                  <DropdownMenuItem key={s} onClick={() => changeStatus(s)} className="text-xs gap-2">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_META[s].dot)} />
                    {STATUS_META[s].label}
                    {appt.status === s && <span className="ml-auto text-gray-400">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── List View ─────────────────────────────────────────────
function ApptListView({ appointments, users, onApptClick, onNewAppt }: {
  appointments: Appointment[]; users: WorkspaceUser[];
  onApptClick: (a: Appointment) => void; onNewAppt: () => void;
}) {
  const [tab, setTab] = useState<"upcoming" | "cancelled" | "all">("upcoming");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<Set<ApptType>>(new Set());
  const router = useRouter();

  const now = new Date().toISOString();
  const filtered = appointments.filter(a => {
    if (tab === "upcoming") return a.startAt >= now && a.status !== "CANCELADA";
    if (tab === "cancelled") return a.status === "CANCELADA";
    return true;
  }).filter(a => typeFilter.size === 0 || typeFilter.has(a.type))
    .filter(a => !search || `${a.title} ${a.leadName ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  function toggleType(t: ApptType) {
    setTypeFilter(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  async function changeStatus(appt: Appointment, status: ApptStatus) {
    await updateApptStatus(appt.id, status);
    router.refresh();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[17px] font-bold text-gray-900">Citas</h2>
        <Button size="sm" onClick={onNewAppt} className="h-8 gap-1.5 text-[12px]">
          <Plus className="h-3.5 w-3.5" /> Nueva cita
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-gray-100 mb-4">
        {([["upcoming","Próximas"],["cancelled","Canceladas"],["all","Todas"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors",
              tab === k ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700")}>
            {l}
          </button>
        ))}
      </div>

      {/* Search + type filter */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
            className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-primary bg-white" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {APPT_TYPES.map(t => {
            const meta = TYPE_META[t];
            const active = typeFilter.has(t);
            return (
              <button key={t} onClick={() => toggleType(t)}
                className={cn("flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border transition-all",
                  active ? cn(meta.bg, meta.border, meta.color) : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                {meta.label}
              </button>
            );
          })}
        </div>
        <p className="text-[12px] text-gray-400 ml-auto">{filtered.length} cita{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
          <Calendar className="h-10 w-10 opacity-20" />
          <p className="text-sm">Sin citas</p>
          {tab === "upcoming" && (
            <Button variant="outline" size="sm" onClick={onNewAppt} className="mt-1">Crear primera cita</Button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-100">
                {["#","Título","Contacto","Asignado","Estado","Fecha y hora","Tipo",""].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => {
                const meta = TYPE_META[a.type]; const Icon = meta.Icon;
                const assignedUser = users.find(u => u.id === a.assignedTo);
                return (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors" onClick={() => onApptClick(a)}>
                    <td className="py-3 pr-4 text-gray-400 font-mono text-[11px]">{idx+1}</td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-gray-900">{a.title}</p>
                      {a.location && <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5"><MapPin className="h-2.5 w-2.5" />{a.location}</p>}
                      {a.meetingUrl && <p className="text-[10px] text-primary flex items-center gap-0.5 mt-0.5"><Link2 className="h-2.5 w-2.5" />Link reunión</p>}
                    </td>
                    <td className="py-3 pr-4">
                      {a.leadName ? (
                        <div><p className="font-medium text-gray-800">{a.leadName}</p>
                        {a.leadPhone && <p className="text-[10px] text-gray-400">{a.leadPhone}</p>}</div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      {assignedUser ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">{assignedUser.name[0]}</div>
                          <span className="text-[11px] text-gray-700">{assignedUser.name.split(" ")[0]}</span>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 pr-4" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn("text-[10px] font-semibold rounded-full px-2.5 py-1 border flex items-center gap-1 hover:opacity-80 transition-opacity", STATUS_META[a.status].cls)}>
                            {STATUS_META[a.status].label} <ChevronDown className="h-2.5 w-2.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {(Object.keys(STATUS_META) as ApptStatus[]).map(s => (
                            <DropdownMenuItem key={s} onClick={() => changeStatus(a, s)} className="text-xs gap-2">
                              <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_META[s].dot)} />
                              {STATUS_META[s].label}
                              {a.status === s && <span className="ml-auto text-gray-400">✓</span>}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-gray-800 font-medium">{fmtDate(a.startAt)}</p>
                      <p className="text-[10px] text-gray-400">{fmtTime(a.startAt)} – {fmtTime(a.endAt)}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5", meta.bg, meta.color)}>
                        <Icon className="h-2.5 w-2.5" />{meta.label}
                      </span>
                    </td>
                    <td className="py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => onApptClick(a)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 transition-colors">
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────
function SettingsTab({ settings, onSave }: { settings: CalSettings; onSave: (p: Partial<CalSettings>) => void }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const setD = (k: keyof CalSettings, v: unknown) => setDraft(d => ({ ...d, [k]: v }));

  function handleSave() {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 max-w-2xl">
      <h2 className="text-[18px] font-bold text-gray-900 mb-6">Configuración de calendario</h2>

      {/* Working days */}
      <section className="mb-8">
        <h3 className="text-[13px] font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" /> Días laborables
        </h3>
        <p className="text-[12px] text-gray-400 mb-3">Días en que se muestran horas hábiles en el calendario</p>
        <div className="flex gap-2">
          {DAY_LABELS.map((d, i) => (
            <button key={d} onClick={() => {
              const next = [...draft.workingDays]; next[i] = !next[i];
              setD("workingDays", next);
            }} className={cn("h-9 w-9 rounded-xl text-[12px] font-semibold border transition-all",
              draft.workingDays[i] ? "bg-primary text-white border-primary" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300")}>
              {d[0]}
            </button>
          ))}
        </div>
      </section>

      {/* Working hours */}
      <section className="mb-8">
        <h3 className="text-[13px] font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Horario laboral
        </h3>
        <p className="text-[12px] text-gray-400 mb-3">Las horas fuera de este rango aparecen sombreadas en el calendario</p>
        <div className="flex items-center gap-3">
          <div>
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">Inicio</label>
            <select value={draft.workStart} onChange={e => setD("workStart", Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              {HOURS.map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
          </div>
          <span className="text-gray-400 text-[13px] mt-4">—</span>
          <div>
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">Fin</label>
            <select value={draft.workEnd} onChange={e => setD("workEnd", Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              {HOURS.filter(h => h > draft.workStart).map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Defaults */}
      <section className="mb-8">
        <h3 className="text-[13px] font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" /> Valores por defecto
        </h3>
        <p className="text-[12px] text-gray-400 mb-3">Se aplican al crear nuevas citas</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">Duración</label>
            <select value={draft.defaultDuration} onChange={e => setD("defaultDuration", Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              {DURATION_OPTIONS.map(d => (
                <option key={d} value={d}>{d < 60 ? `${d} min` : d === 60 ? "1 hora" : `${d/60}h`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">Tipo de cita</label>
            <select value={draft.defaultType} onChange={e => setD("defaultType", e.target.value as ApptType)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              {APPT_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">Vista inicial</label>
            <select value={draft.defaultView} onChange={e => setD("defaultView", e.target.value as CalView)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              <option value="day">Day view</option>
              <option value="week">Week view</option>
              <option value="month">Month view</option>
            </select>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="mb-8">
        <h3 className="text-[13px] font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Comportamiento
        </h3>
        <p className="text-[12px] text-gray-400 mb-3">Opciones de automatización al crear citas</p>
        <label className="flex items-center gap-3 cursor-pointer group w-fit">
          <div onClick={() => setD("autoConfirm", !draft.autoConfirm)}
            className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0",
              draft.autoConfirm ? "bg-primary" : "bg-gray-200")}>
            <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
              draft.autoConfirm ? "translate-x-4" : "translate-x-0.5")} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-gray-800">Auto-confirmar citas nuevas</p>
            <p className="text-[11px] text-gray-400">Las citas se crean con estado &quot;Confirmada&quot; en vez de &quot;Agendada&quot;</p>
          </div>
        </label>
      </section>

      <Button onClick={handleSave} className="gap-2">
        {saved ? <><Check className="h-4 w-4" /> Guardado</> : "Guardar configuración"}
      </Button>
    </div>
  );
}

// ── Main CalendarClient ───────────────────────────────────
export function CalendarClient({ appointments, leads, users, workspaceId }: {
  appointments: Appointment[]; leads: Lead[];
  users: WorkspaceUser[]; workspaceId: string;
}) {
  const { settings, save: saveSettings } = useCalSettings(workspaceId);
  const [activeTab, setActiveTab] = useState<"calendar" | "list" | "settings">("calendar");
  const [calView, setCalView] = useState<CalView>(settings.defaultView);
  const [anchor, setAnchor] = useState(() => getWeekStart(new Date()));
  const [modal, setModal] = useState<{ startAt?: string; appt?: Appointment } | null>(null);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<ApptType>>(new Set(APPT_TYPES));
  const [search, setSearch] = useState("");

  // Apply defaultView from settings on first load
  useEffect(() => {
    setCalView(settings.defaultView);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  function switchView(v: CalView) {
    setCalView(v);
    if (v === "week") setAnchor(a => getWeekStart(a));
  }

  function prev() {
    setAnchor(a => {
      const d = new Date(a);
      if (calView === "day")   d.setDate(d.getDate() - 1);
      if (calView === "week")  d.setDate(d.getDate() - 7);
      if (calView === "month") d.setMonth(d.getMonth() - 1);
      return d;
    });
  }
  function next() {
    setAnchor(a => {
      const d = new Date(a);
      if (calView === "day")   d.setDate(d.getDate() + 1);
      if (calView === "week")  d.setDate(d.getDate() + 7);
      if (calView === "month") d.setMonth(d.getMonth() + 1);
      return d;
    });
  }
  function goToday() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    setAnchor(calView === "week" ? getWeekStart(d) : d);
  }

  function toggleType(t: ApptType) {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  function onMiniDayClick(day: Date) {
    const d = new Date(day); d.setHours(0, 0, 0, 0);
    if (calView === "week") setAnchor(getWeekStart(d));
    else if (calView === "month") { const m = new Date(d.getFullYear(), d.getMonth(), 1); setAnchor(m); }
    else setAnchor(d);
  }

  const navLabel = (() => {
    if (calView === "day") return anchor.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (calView === "week") {
      const days = getWeekDays(anchor); const end = days[6];
      if (anchor.getMonth() === end.getMonth())
        return `${anchor.getDate()} – ${end.getDate()} ${MONTHS_ES[anchor.getMonth()]} ${anchor.getFullYear()}`;
      return `${anchor.getDate()} ${MONTHS_ES[anchor.getMonth()]} – ${end.getDate()} ${MONTHS_ES[end.getMonth()]} ${anchor.getFullYear()}`;
    }
    return `${MONTHS_ES[anchor.getMonth()].charAt(0).toUpperCase()}${MONTHS_ES[anchor.getMonth()].slice(1)} ${anchor.getFullYear()}`;
  })();

  const gridDays = calView === "day" ? [anchor] : getWeekDays(anchor);

  // Filter appointments for calendar views
  const visibleAppts = appointments.filter(a =>
    activeTypes.has(a.type) &&
    (!search || `${a.title} ${a.leadName ?? ""}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top tabs */}
      <div className="flex items-center justify-between px-6 pt-4 pb-0 border-b border-gray-100">
        <div className="flex items-center gap-5">
          {([["calendar","Vista calendario"],["list","Lista de citas"],["settings","Configuración"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className={cn("pb-3 text-[13px] font-medium border-b-2 transition-colors",
                activeTab === k ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar controls */}
      {activeTab === "calendar" && (
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100">
          <button onClick={goToday} className="text-[12px] font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors shrink-0">
            Hoy
          </button>
          <div className="flex items-center gap-1">
            <button onClick={prev} className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-500" />
            </button>
            <span className="text-[13px] font-semibold text-gray-800 capitalize min-w-[160px] text-center">{navLabel}</span>
            <button onClick={next} className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-500" />
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 text-[12px] font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors shrink-0">
                {VIEW_LABELS[calView]} <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              {(["day","week","month"] as CalView[]).map(v => (
                <DropdownMenuItem key={v} onClick={() => switchView(v)} className="text-[12px] gap-2">
                  {VIEW_LABELS[v]}
                  {calView === v && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search */}
          <div className="relative ml-2 flex-1 max-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar citas…"
              className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-primary bg-white" />
          </div>

          <div className="ml-auto">
            <Button size="sm" onClick={() => setModal({})} className="h-8 gap-1.5 text-[12px]">
              <Plus className="h-3.5 w-3.5" /> Nueva cita
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 flex">
        {/* Sidebar — only in calendar tab */}
        {activeTab === "calendar" && (
          <CalendarSidebar
            appointments={appointments}
            anchor={anchor}
            today={today}
            calView={calView}
            activeTypes={activeTypes}
            onTypeToggle={toggleType}
            onDayClick={onMiniDayClick}
          />
        )}

        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === "calendar" && calView !== "month" && (
            <TimeGrid
              appointments={visibleAppts}
              days={gridDays}
              today={today}
              settings={settings}
              onSlotClick={startAt => setModal({ startAt })}
              onApptClick={a => setDetail(a)}
            />
          )}
          {activeTab === "calendar" && calView === "month" && (
            <MonthView
              appointments={visibleAppts}
              anchor={anchor}
              today={today}
              onDayClick={day => {
                const d = new Date(day);
                d.setHours(settings.workStart, 0, 0, 0);
                setModal({ startAt: toLocalISO(d) });
              }}
              onApptClick={a => setDetail(a)}
            />
          )}
          {activeTab === "list" && (
            <ApptListView
              appointments={appointments}
              users={users}
              onApptClick={a => setModal({ appt: a })}
              onNewAppt={() => setModal({})}
            />
          )}
          {activeTab === "settings" && (
            <SettingsTab settings={settings} onSave={saveSettings} />
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {detail && (
          <ApptDetail key="detail" appt={detail} users={users}
            onEdit={() => { setModal({ appt: detail }); setDetail(null); }}
            onClose={() => setDetail(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal !== null && (
          <ApptModal key="modal" initial={modal} leads={leads} users={users}
            workspaceId={workspaceId} settings={settings}
            onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
