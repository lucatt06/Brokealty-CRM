"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Phone, MessageCircle, Tag, FileText, CheckSquare, Calendar,
  PhoneOff, Voicemail, Send, Upload, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addNote, createTask, createAppointment } from "@/app/actions/leads";
import { useRouter } from "next/navigation";

export type ActionType = "call" | "message" | "tag" | "document" | "task" | "appointment";

type PanelDeal = {
  id: string;
  workspaceId: string;
  lead: { id: string; firstName: string; lastName: string | null; phone: string };
};

function initials(lead: PanelDeal["lead"]) {
  return `${lead.firstName[0]}${lead.lastName?.[0] ?? ""}`.toUpperCase();
}

const PANEL_META: Record<ActionType, { label: string; Icon: React.ElementType; color: string }> = {
  call:        { label: "Registrar llamada",  Icon: Phone,          color: "text-green-600" },
  message:     { label: "Enviar mensaje",     Icon: MessageCircle,  color: "text-blue-600" },
  tag:         { label: "Etiquetas",          Icon: Tag,            color: "text-purple-600" },
  document:    { label: "Documentos",         Icon: FileText,       color: "text-amber-600" },
  task:        { label: "Nueva tarea",        Icon: CheckSquare,    color: "text-indigo-600" },
  appointment: { label: "Agendar cita",       Icon: Calendar,       color: "text-rose-600" },
};

// ── Call Panel ───────────────────────────────────────────
function CallPanel({ deal, onClose }: { deal: PanelDeal; onClose: () => void }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<"contestó" | "no contestó" | "buzón">("contestó");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const outcomes = [
    { id: "contestó" as const,     Icon: Phone,        label: "Contestó",       color: "border-green-400 text-green-700 bg-green-50" },
    { id: "no contestó" as const,  Icon: PhoneOff,     label: "No contestó",    color: "border-gray-300 text-gray-600 bg-gray-50" },
    { id: "buzón" as const,        Icon: Voicemail,    label: "Buzón de voz",   color: "border-amber-400 text-amber-700 bg-amber-50" },
  ];

  async function save() {
    setSaving(true);
    const parts = [
      `📞 Llamada — ${outcome}`,
      duration ? `Duración: ${duration} min` : null,
      notes ? notes : null,
    ].filter(Boolean);
    await addNote(deal.workspaceId, deal.lead.id, parts.join(" · "));
    router.refresh();
    setSaving(false);
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Outcome */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Resultado</p>
        <div className="grid grid-cols-3 gap-2">
          {outcomes.map(({ id, Icon, label, color }) => (
            <button key={id} onClick={() => setOutcome(id)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-[11px] font-medium transition-all",
                outcome === id ? color : "border-gray-200 text-gray-400 bg-white hover:border-gray-300"
              )}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Duración (minutos)</p>
        <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="0"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white" />
      </div>

      {/* Notes */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notas</p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="¿Qué se habló en la llamada?"
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white resize-none" />
      </div>

      <Button onClick={save} disabled={saving} className="w-full h-9 gap-2">
        <Phone className="h-3.5 w-3.5" />
        {saving ? "Guardando…" : "Registrar llamada"}
      </Button>
    </div>
  );
}

// ── Message Panel ────────────────────────────────────────
function MessagePanel({ deal, onClose }: { deal: PanelDeal; onClose: () => void }) {
  const router = useRouter();
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const channels = [
    { id: "whatsapp" as const, label: "WhatsApp", emoji: "💬" },
    { id: "sms" as const,      label: "SMS",       emoji: "📱" },
    { id: "email" as const,    label: "Email",     emoji: "✉️" },
  ];

  async function send() {
    if (!message.trim()) return;
    setSaving(true);
    await addNote(deal.workspaceId, deal.lead.id, `${channel === "whatsapp" ? "💬" : channel === "sms" ? "📱" : "✉️"} Mensaje enviado (${channel}): ${message}`);
    router.refresh();
    setSaving(false);
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Channel */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Canal</p>
        <div className="flex gap-2">
          {channels.map(({ id, label, emoji }) => (
            <button key={id} onClick={() => setChannel(id)}
              className={cn(
                "flex-1 py-2 px-1 rounded-xl border text-[12px] font-medium transition-all",
                channel === id ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-400 hover:border-gray-300"
              )}>
              {emoji} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recipient */}
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
        <div className="h-7 w-7 rounded-full bg-gray-200 text-[11px] font-bold flex items-center justify-center text-gray-600">
          {initials(deal.lead)}
        </div>
        <div>
          <p className="text-[12px] font-semibold text-gray-800">{deal.lead.firstName} {deal.lead.lastName ?? ""}</p>
          <p className="text-[11px] text-gray-400">{deal.lead.phone}</p>
        </div>
      </div>

      {/* Message */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Mensaje</p>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder={`Escribe tu mensaje de ${channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : "correo"}…`}
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white resize-none" />
      </div>

      <Button onClick={send} disabled={saving || !message.trim()} className="w-full h-9 gap-2">
        <Send className="h-3.5 w-3.5" />
        {saving ? "Enviando…" : "Enviar mensaje"}
      </Button>
    </div>
  );
}

// ── Tag Panel ────────────────────────────────────────────
const PRESET_TAGS = [
  { id: "caliente",   label: "Caliente",     color: "bg-red-100 text-red-700 border-red-200" },
  { id: "prospect",  label: "Prospecto",    color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "vip",       label: "VIP",          color: "bg-purple-100 text-purple-700 border-purple-200" },
  { id: "seguimiento", label: "Seguimiento", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "listo",     label: "Listo comprar", color: "bg-green-100 text-green-700 border-green-200" },
  { id: "financiamiento", label: "Financiamiento", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { id: "importado", label: "Importado",    color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { id: "recurrente", label: "Recurrente",  color: "bg-teal-100 text-teal-700 border-teal-200" },
];

function TagPanel({ deal, onClose }: { deal: PanelDeal; onClose: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  async function save() {
    const tags = [...selected];
    if (custom.trim()) tags.push(custom.trim());
    if (!tags.length) return;
    setSaving(true);
    await addNote(deal.workspaceId, deal.lead.id, `🏷️ Etiquetas asignadas: ${tags.join(", ")}`);
    router.refresh();
    setSaving(false);
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Etiquetas predefinidas</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_TAGS.map(t => (
            <button key={t.id} onClick={() => toggle(t.id)}
              className={cn(
                "px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all",
                selected.has(t.id) ? `${t.color} ring-2 ring-offset-1 ring-current` : "border-gray-200 text-gray-500 hover:border-gray-300"
              )}>
              {selected.has(t.id) && <Check className="h-2.5 w-2.5 inline mr-1" />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Etiqueta personalizada</p>
        <input value={custom} onChange={e => setCustom(e.target.value)}
          placeholder="Escribe una etiqueta…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white"
          onKeyDown={e => e.key === "Enter" && save()} />
      </div>

      <Button onClick={save} disabled={saving || (selected.size === 0 && !custom.trim())} className="w-full h-9 gap-2">
        <Tag className="h-3.5 w-3.5" />
        {saving ? "Guardando…" : `Aplicar${selected.size > 0 ? ` (${selected.size})` : ""}`}
      </Button>
    </div>
  );
}

// ── Document Panel ───────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- deal/onClose reservados para cuando se implemente subida real
function DocumentPanel({ deal, onClose }: { deal: PanelDeal; onClose: () => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); }}
        onDragOver={e => e.preventDefault()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-gray-200 bg-gray-50"
        )}>
        <div className="h-12 w-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
          <Upload className="h-5 w-5 text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-medium text-gray-700">Arrastra archivos aquí</p>
          <p className="text-[11px] text-gray-400 mt-0.5">PDF, JPG, PNG — hasta 10 MB</p>
        </div>
        <label className="cursor-pointer">
          <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" />
          <span className="text-[12px] text-primary font-medium hover:underline">Seleccionar archivos</span>
        </label>
      </div>

      <div className="rounded-xl border border-gray-100 p-3.5 bg-gray-50">
        <p className="text-[11px] text-gray-400 text-center">Sin documentos adjuntos</p>
      </div>

      <p className="text-[10px] text-gray-300 text-center">
        La gestión de documentos estará disponible próximamente
      </p>
    </div>
  );
}

// ── Task Panel ───────────────────────────────────────────
const PRIORITIES = [
  { id: "BAJA",    label: "Baja",    color: "border-gray-300 text-gray-600 bg-gray-50" },
  { id: "MEDIA",   label: "Media",   color: "border-blue-400 text-blue-700 bg-blue-50" },
  { id: "ALTA",    label: "Alta",    color: "border-amber-400 text-amber-700 bg-amber-50" },
  { id: "URGENTE", label: "Urgente", color: "border-red-400 text-red-700 bg-red-50" },
] as const;

function TaskPanel({ deal, onClose }: { deal: PanelDeal; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"BAJA" | "MEDIA" | "ALTA" | "URGENTE">("MEDIA");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    await createTask(deal.workspaceId, deal.lead.id, title.trim(), priority, dueAt || null);
    router.refresh();
    setSaving(false);
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Título *</p>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Ej: Llamar para seguimiento, Enviar cotización…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white"
          onKeyDown={e => e.key === "Enter" && save()} autoFocus />
      </div>

      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Prioridad</p>
        <div className="grid grid-cols-4 gap-1.5">
          {PRIORITIES.map(p => (
            <button key={p.id} onClick={() => setPriority(p.id)}
              className={cn(
                "py-2 rounded-lg border text-[11px] font-semibold transition-all",
                priority === p.id ? p.color : "border-gray-200 text-gray-400 hover:border-gray-300"
              )}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Fecha límite</p>
        <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white" />
      </div>

      <Button onClick={save} disabled={saving || !title.trim()} className="w-full h-9 gap-2">
        <CheckSquare className="h-3.5 w-3.5" />
        {saving ? "Creando…" : "Crear tarea"}
      </Button>
    </div>
  );
}

// ── Appointment Panel ────────────────────────────────────
const APPT_TYPES = [
  { id: "VISITA_DEALER", label: "Visita al dealer" },
  { id: "TEST_DRIVE",    label: "Test drive" },
  { id: "LLAMADA",       label: "Llamada" },
  { id: "VIDEO_LLAMADA", label: "Videollamada" },
  { id: "ENTREGA",       label: "Entrega" },
  { id: "SEGUIMIENTO",   label: "Seguimiento" },
] as const;

function AppointmentPanel({ deal, onClose }: { deal: PanelDeal; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", type: "VISITA_DEALER" as typeof APPT_TYPES[number]["id"],
    startAt: "", endAt: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.title.trim() || !form.startAt || !form.endAt) return;
    setSaving(true);
    await createAppointment(deal.workspaceId, deal.lead.id, form.title, form.type, form.startAt, form.endAt, form.notes || undefined);
    router.refresh();
    setSaving(false);
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Título *</p>
        <input value={form.title} onChange={e => set("title", e.target.value)}
          placeholder="Ej: Demo Toyota RAV4, Test Drive…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white" autoFocus />
      </div>

      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tipo</p>
        <select value={form.type} onChange={e => set("type", e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white">
          {APPT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Inicio *</p>
          <input type="datetime-local" value={form.startAt} onChange={e => set("startAt", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[11px] outline-none focus:ring-1 focus:ring-primary bg-white" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Fin *</p>
          <input type="datetime-local" value={form.endAt} onChange={e => set("endAt", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[11px] outline-none focus:ring-1 focus:ring-primary bg-white" />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notas</p>
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
          placeholder="Detalles adicionales…" rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white resize-none" />
      </div>

      <Button onClick={save} disabled={saving || !form.title.trim() || !form.startAt || !form.endAt}
        className="w-full h-9 gap-2">
        <Calendar className="h-3.5 w-3.5" />
        {saving ? "Agendando…" : "Agendar cita"}
      </Button>
    </div>
  );
}

// ── Main QuickActionPanel ────────────────────────────────
export function QuickActionPanel({
  deal, action, onClose,
}: {
  deal: PanelDeal | null;
  action: ActionType | null;
  onClose: () => void;
}) {
  const meta = action ? PANEL_META[action] : null;

  return (
    <AnimatePresence>
      {deal && action && meta && (
        <>
          <motion.div className="fixed inset-0 bg-black/10 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />
          <motion.div
            className="fixed right-0 top-0 h-full w-[340px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 38 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className={cn("h-8 w-8 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100", meta.color)}>
                  <meta.Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-gray-900">{meta.label}</p>
                  <p className="text-[11px] text-gray-400">{deal.lead.firstName} {deal.lead.lastName ?? ""}</p>
                </div>
              </div>
              <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {action === "call"        && <CallPanel        deal={deal} onClose={onClose} />}
              {action === "message"     && <MessagePanel     deal={deal} onClose={onClose} />}
              {action === "tag"         && <TagPanel         deal={deal} onClose={onClose} />}
              {action === "document"    && <DocumentPanel    deal={deal} onClose={onClose} />}
              {action === "task"        && <TaskPanel        deal={deal} onClose={onClose} />}
              {action === "appointment" && <AppointmentPanel deal={deal} onClose={onClose} />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
