"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  X, Calendar, ChevronDown, Check, Trash2, Plus, PlayCircle,
  UserSquare2, UserPlus, Info, ArrowRightLeft, RotateCcw,
  Wrench, Search, Download, Tag as TagIcon, Globe, Mail, CalendarClock,
  CalendarCheck, Clock3, UserCog, StickyNote, ListChecks, Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Shared types ──────────────────────────────────────────
export type WUser = { id: string; name: string };
export type WTag = { id: string; name: string; color: string };
export type WWorkflow = { id: string; name: string };
export type OtherAgent = { id: string; name: string; status: string; channels: string[]; isPrimary: boolean };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Modal shell ───────────────────────────────────────────
export function ModalShell({ icon: Icon, iconColor = "text-primary", iconBg = "bg-primary/10", title, subtitle, onClose, width = 630, children, footer }: {
  icon: React.ElementType; iconColor?: string; iconBg?: string; title: string; subtitle: React.ReactNode;
  onClose: () => void; width?: number; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-white rounded-2xl shadow-2xl flex flex-col max-h-[88vh]" style={{ width }}
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
            <p className="text-[11.5px] text-gray-400">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 shrink-0"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-gray-100 shrink-0">{footer}</div>
      </motion.div>
    </motion.div>
  );
}

// ── Small field helpers ───────────────────────────────────
export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <label className="text-[12px] font-semibold text-gray-700 block mb-1">{children} {required && <span className="text-red-500">*</span>}</label>;
}
export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-gray-400 mt-1">{children}</p>;
}
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary", props.className)} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none", props.className)} />;
}
export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0", value ? "bg-primary" : "bg-gray-200")}>
      <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", value ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

// ── Scenario sidebar shell (Human Handover / Bot Transfer / Auto Follow-up) ──
export type Scenario = { id: string; name: string; enabled: boolean; [key: string]: unknown };

export function ScenarioSidebarShell({ scenarios, activeId, onSelectScenario, children }: {
  scenarios: Scenario[]; activeId: string; onSelectScenario: (id: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[420px]">
      <div className="w-[190px] shrink-0 border-r border-gray-100 py-2">
        {scenarios.map((s) => (
          <button key={s.id} onClick={() => onSelectScenario(s.id)}
            className={cn("w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-[12.5px] border-l-2 transition-colors",
              activeId === s.id ? "border-primary text-primary bg-primary/5 font-medium" : "border-transparent text-gray-600 hover:bg-gray-50")}>
            <span className="truncate">{s.name || "Sin nombre"}</span>
            <span className={cn("text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full shrink-0", s.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400")}>
              {s.enabled ? "On" : "Off"}
            </span>
          </button>
        ))}
      </div>
      <div className="flex-1 px-5 py-4 overflow-y-auto">{children}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// APPOINTMENT BOOKING
// ══════════════════════════════════════════════════════════
export type AppointmentBookingConfig = {
  minNoticeHours: number;
  confirmationMessage: string;
  onlySendBookingLink: boolean;
  pauseAfterBooking: boolean;
  triggerWorkflowAfterBooking: boolean;
  workflowIds: string[];
  transferAfterBooking: boolean;
  transferToAgentId: string;
  allowCancellation: boolean;
  allowRescheduling: boolean;
};

export function AppointmentBookingModal({ initial, workflows, otherAgents, onClose, onSave, onRemove, hasExisting }: {
  initial?: Partial<AppointmentBookingConfig>; workflows: WWorkflow[]; otherAgents: OtherAgent[];
  onClose: () => void; onRemove: () => void;
  onSave: (config: AppointmentBookingConfig) => Promise<void>; hasExisting: boolean;
}) {
  const [minNoticeHours, setMinNoticeHours] = useState(initial?.minNoticeHours ?? 2);
  const [confirmationMessage, setConfirmationMessage] = useState(initial?.confirmationMessage ?? "¡Listo! Tu cita ha sido agendada. Te esperamos.");
  const [onlySendBookingLink, setOnlySendBookingLink] = useState(initial?.onlySendBookingLink ?? false);
  const [pauseAfterBooking, setPauseAfterBooking] = useState(initial?.pauseAfterBooking ?? false);
  const [triggerWorkflowAfterBooking, setTriggerWorkflowAfterBooking] = useState(initial?.triggerWorkflowAfterBooking ?? false);
  const [workflowIds, setWorkflowIds] = useState<string[]>(initial?.workflowIds ?? []);
  const [transferAfterBooking, setTransferAfterBooking] = useState(initial?.transferAfterBooking ?? false);
  const [transferToAgentId, setTransferToAgentId] = useState(initial?.transferToAgentId ?? "");
  const [allowCancellation, setAllowCancellation] = useState(initial?.allowCancellation ?? false);
  const [allowRescheduling, setAllowRescheduling] = useState(initial?.allowRescheduling ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({
      minNoticeHours, confirmationMessage, onlySendBookingLink, pauseAfterBooking,
      triggerWorkflowAfterBooking, workflowIds, transferAfterBooking, transferToAgentId,
      allowCancellation, allowRescheduling,
    });
    setSaving(false);
  }

  return (
    <ModalShell icon={Calendar} title="Appointment Booking" subtitle="Define the logic for booking an appointment" onClose={onClose}
      footer={
        <>
          {hasExisting ? <Button variant="outline" size="sm" onClick={onRemove} className="text-red-500 gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Remove</Button> : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={saving} onClick={handleSave}>{saving ? "Guardando…" : "Save"}</Button>
          </div>
        </>
      }>
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
          <Calendar className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
          <p className="text-[11.5px] text-gray-500 leading-relaxed">
            Las citas se agendan en el <span className="font-semibold text-gray-700">Calendario de citas</span>. El propósito de cada cita (Firma de contrato, Entrega, etc.) se define al momento de agendarla.
          </p>
        </div>
        <div>
          <FieldLabel>Minimum notice (hours)</FieldLabel>
          <FieldHint>La IA no ofrecerá horarios con menos de este tiempo de anticipación.</FieldHint>
          <TextInput type="number" min={0} value={minNoticeHours} onChange={(e) => setMinNoticeHours(Number(e.target.value))} className="w-28 mt-1.5" />
        </div>
        <div>
          <FieldLabel>Confirmation message</FieldLabel>
          <FieldHint>Mensaje que el bot enviará al confirmar la cita.</FieldHint>
          <TextArea rows={3} value={confirmationMessage} onChange={(e) => setConfirmationMessage(e.target.value)} className="mt-1.5" />
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-2 text-[12.5px] font-medium text-gray-700">
            <input type="checkbox" checked={onlySendBookingLink} onChange={(e) => setOnlySendBookingLink(e.target.checked)} className="accent-primary h-3.5 w-3.5 mt-0.5" />
            <span>
              Don&apos;t book appointment (only send the booking link)
              <span className="block text-[11px] font-normal text-gray-400">Selecting this will stop the bot from booking the appointment and directly send the booking link to the contact</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-[12.5px] font-medium text-gray-700">
            <input type="checkbox" checked={pauseAfterBooking} onChange={(e) => setPauseAfterBooking(e.target.checked)} className="accent-primary h-3.5 w-3.5 mt-0.5" />
            <span>
              Pause bot responses after booking
              <span className="block text-[11px] font-normal text-gray-400">Disable further bot responses after an appointment is successfully booked</span>
            </span>
          </label>
          <div>
            <label className="flex items-start gap-2 text-[12.5px] font-medium text-gray-700">
              <input type="checkbox" checked={triggerWorkflowAfterBooking} onChange={(e) => setTriggerWorkflowAfterBooking(e.target.checked)} className="accent-primary h-3.5 w-3.5 mt-0.5" />
              <span>
                Trigger workflow after booking
                <span className="block text-[11px] font-normal text-gray-400">Execute specified workflows on successful appointment booking</span>
              </span>
            </label>
            {triggerWorkflowAfterBooking && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex flex-wrap items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 min-h-[38px] text-left mt-2 ml-5">
                    {workflowIds.length === 0
                      ? <span className="text-[12.5px] text-gray-300">Select one or more workflows</span>
                      : workflowIds.map((id) => (
                        <span key={id} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{workflows.find((w) => w.id === id)?.name ?? id}</span>
                      ))}
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {workflows.length === 0 && <p className="text-[11px] text-gray-400 px-2 py-3 text-center">No hay workflows publicados aún</p>}
                  {workflows.map((w) => (
                    <DropdownMenuItem key={w.id} onSelect={(e) => e.preventDefault()} onClick={() => {
                      setWorkflowIds((prev) => prev.includes(w.id) ? prev.filter((x) => x !== w.id) : [...prev, w.id]);
                    }} className="text-xs gap-2">
                      <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center", workflowIds.includes(w.id) ? "bg-primary border-primary" : "border-gray-300")}>
                        {workflowIds.includes(w.id) && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      {w.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div>
            <label className="flex items-start gap-2 text-[12.5px] font-medium text-gray-700">
              <input type="checkbox" checked={transferAfterBooking} onChange={(e) => setTransferAfterBooking(e.target.checked)} className="accent-primary h-3.5 w-3.5 mt-0.5" />
              <span>
                Transfer Employee post appointment booking
                <span className="block text-[11px] font-normal text-gray-400">Transfer to a specified Employee on successful appointment booking</span>
              </span>
            </label>
            {transferAfterBooking && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] text-left mt-2 ml-5">
                    <span className={transferToAgentId ? "text-gray-800" : "text-gray-300"}>{otherAgents.find((a) => a.id === transferToAgentId)?.name ?? "Select Employee"}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {otherAgents.length === 0 && <p className="text-[11px] text-gray-400 px-2 py-3 text-center">Crea otro agente primero</p>}
                  {otherAgents.map((a) => <DropdownMenuItem key={a.id} onClick={() => setTransferToAgentId(a.id)} className="text-xs">{a.name}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3.5 space-y-3">
          <label className="flex items-start gap-2 text-[12.5px] font-medium text-gray-700">
            <Toggle value={allowCancellation} onChange={setAllowCancellation} />
            <span>
              Allow bot to cancel the appointment
              <span className="block text-[11px] font-normal text-gray-400">Enable this option to allow the AI bot to cancel any existing appointments. Any appointments can be cancelled by the bot based on the appointment&apos;s setting.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-[12.5px] font-medium text-gray-700">
            <Toggle value={allowRescheduling} onChange={setAllowRescheduling} />
            <span>
              Allow bot to reschedule the appointment
              <span className="block text-[11px] font-normal text-gray-400">Enable this option to allow the AI bot to reschedule any existing appointments. Any appointments can be rescheduled by the bot based on the appointment&apos;s setting.</span>
            </span>
          </label>
        </div>

        {(allowCancellation || allowRescheduling) && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <span className="font-semibold">Note:</span> Asegúrate de que tu prompt no incluya instrucciones como &quot;No puedo ayudarte con cancelaciones o reprogramaciones&quot; cuando actives estas funciones, ya que puede confundir al bot.
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ══════════════════════════════════════════════════════════
// TRIGGER A WORKFLOW
// ══════════════════════════════════════════════════════════
type WorkflowTrigger = { id: string; name: string; workflowIds: string[]; condition: string };
export type TriggerWorkflowConfig = { triggers: WorkflowTrigger[] };

export function TriggerWorkflowModal({ initial, workflows, onClose, onSave }: {
  initial?: TriggerWorkflowConfig; workflows: WWorkflow[]; onClose: () => void; onSave: (c: TriggerWorkflowConfig) => Promise<void>;
}) {
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>(
    initial?.triggers?.length ? initial.triggers : [{ id: uid(), name: "Trigger Workflow 1", workflowIds: [], condition: "" }]
  );
  const [activeId, setActiveId] = useState(triggers[0].id);
  const [saving, setSaving] = useState(false);
  const active = triggers.find((t) => t.id === activeId) ?? triggers[0];

  function update(id: string, patch: Partial<WorkflowTrigger>) {
    setTriggers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function addTrigger() {
    const t = { id: uid(), name: `Trigger Workflow ${triggers.length + 1}`, workflowIds: [], condition: "" };
    setTriggers((prev) => [...prev, t]);
    setActiveId(t.id);
  }
  function removeTrigger(id: string) {
    setTriggers((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id && next.length) setActiveId(next[0].id);
      return next;
    });
  }
  async function handleSave() {
    setSaving(true);
    await onSave({ triggers });
    setSaving(false);
  }

  return (
    <ModalShell icon={PlayCircle} title="Trigger a workflow" subtitle={<>The Employee will trigger the workflows when the condition is satisfied <span className="text-primary">(Learn More)</span></>} onClose={onClose}
      footer={<>
        <button onClick={addTrigger} className="flex items-center gap-1.5 text-[12px] text-primary font-medium"><Plus className="h-3.5 w-3.5" /> New Workflow Trigger</button>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={saving || !triggers.length} onClick={handleSave}>{saving ? "Guardando…" : "Save"}</Button></div>
      </>}>
      <div className="flex min-h-[380px]">
        <div className="w-[170px] shrink-0 border-r border-gray-100 py-2">
          {triggers.map((t) => (
            <button key={t.id} onClick={() => setActiveId(t.id)}
              className={cn("w-full text-left px-4 py-2.5 text-[12.5px] border-l-2", activeId === t.id ? "border-primary text-primary bg-primary/5 font-medium" : "border-transparent text-gray-600 hover:bg-gray-50")}>
              <span className="truncate block">{t.name}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 px-5 py-4 space-y-3">
          <div>
            <FieldLabel required>Action name</FieldLabel>
            <TextInput value={active.name} onChange={(e) => update(active.id, { name: e.target.value })} />
            <FieldHint>Enter action name</FieldHint>
          </div>
          <div>
            <FieldLabel required>Select one or more published workflows to trigger</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex flex-wrap items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 min-h-[38px] text-left">
                  {active.workflowIds.length === 0
                    ? <span className="text-[12.5px] text-gray-300">Select one or more workflows</span>
                    : active.workflowIds.map((id) => (
                      <span key={id} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{workflows.find((w) => w.id === id)?.name ?? id}</span>
                    ))}
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {workflows.length === 0 && <p className="text-[11px] text-gray-400 px-2 py-3 text-center">No hay workflows publicados aún</p>}
                {workflows.map((w) => (
                  <DropdownMenuItem key={w.id} onSelect={(e) => e.preventDefault()} onClick={() => {
                    const next = active.workflowIds.includes(w.id) ? active.workflowIds.filter((x) => x !== w.id) : [...active.workflowIds, w.id];
                    update(active.id, { workflowIds: next });
                  }} className="text-xs gap-2">
                    <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center", active.workflowIds.includes(w.id) ? "bg-primary border-primary" : "border-gray-300")}>
                      {active.workflowIds.includes(w.id) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    {w.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <FieldHint>This workflow will be triggered once the below condition is satisfied</FieldHint>
          </div>
          <div>
            <FieldLabel required>When to trigger the workflow</FieldLabel>
            <TextArea rows={3} placeholder="Ex: User agrees to pay for the subscription" value={active.condition} onChange={(e) => update(active.id, { condition: e.target.value })} />
            <FieldHint>Clearly define the scenario and situation when you want the workflows to be triggered</FieldHint>
          </div>
          {triggers.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => removeTrigger(active.id)} className="text-red-500 gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ══════════════════════════════════════════════════════════
// ADD CONTACT INFO
// ══════════════════════════════════════════════════════════
type FieldUpdate = { id: string; name: string; fieldKey: string; instruction: string };
export type ContactInfoConfig = { fields: FieldUpdate[] };

const CONTACT_FIELD_OPTIONS = [
  { key: "source", label: "Fuente (source)" },
  { key: "stage", label: "Etapa del pipeline" },
  { key: "propertyInterest", label: "Propiedad de interés" },
  { key: "budget", label: "Presupuesto estimado" },
  { key: "custom", label: "Otro campo personalizado…" },
];

export function ContactInfoModal({ initial, onClose, onSave }: {
  initial?: ContactInfoConfig; onClose: () => void; onSave: (c: ContactInfoConfig) => Promise<void>;
}) {
  const [fields, setFields] = useState<FieldUpdate[]>(
    initial?.fields?.length ? initial.fields : [{ id: uid(), name: "Field update 1", fieldKey: "", instruction: "" }]
  );
  const [activeId, setActiveId] = useState(fields[0].id);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const active = fields.find((f) => f.id === activeId) ?? fields[0];

  function update(id: string, patch: Partial<FieldUpdate>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function addField() {
    const f = { id: uid(), name: `Field update ${fields.length + 1}`, fieldKey: "", instruction: "" };
    setFields((prev) => [...prev, f]);
    setActiveId(f.id);
  }
  function removeField(id: string) {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (activeId === id && next.length) setActiveId(next[0].id);
      return next;
    });
  }
  async function handleSave() {
    setTouched(true);
    if (fields.some((f) => !f.fieldKey || !f.instruction.trim())) return;
    setSaving(true);
    await onSave({ fields });
    setSaving(false);
  }

  return (
    <ModalShell icon={UserSquare2} title="Add Contact Info" subtitle={<>Use this action to update fields for a contact. This action update empty fields only. <span className="text-primary">(Learn More)</span></>} onClose={onClose}
      footer={<>
        <button onClick={addField} className="flex items-center gap-1.5 text-[12px] text-primary font-medium"><Plus className="h-3.5 w-3.5" /> Add new field</button>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={saving} onClick={handleSave}>{saving ? "Guardando…" : "Save"}</Button></div>
      </>}>
      <div className="flex min-h-[420px]">
        <div className="w-[170px] shrink-0 border-r border-gray-100 py-2">
          {fields.map((f) => (
            <button key={f.id} onClick={() => setActiveId(f.id)}
              className={cn("w-full text-left px-4 py-2.5 text-[12.5px] border-l-2", activeId === f.id ? "border-primary text-primary bg-primary/5 font-medium" : "border-transparent text-gray-600 hover:bg-gray-50")}>
              <span className="truncate block">{f.name}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto">
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11.5px] text-blue-800 leading-relaxed">
              <span className="font-semibold">Tip:</span> After adding this action, ensure that your prompt includes the questions.
              The bot will only be able to update the contact fields if the contact provides the necessary information.
              (e.g., Add this to Additional Instructions in prompt - &apos;Question to ask: When is your birthday?&apos;)
            </p>
          </div>
          <div>
            <FieldLabel required>Action name</FieldLabel>
            <TextInput value={active.name} onChange={(e) => update(active.id, { name: e.target.value })} />
            <FieldHint>Enter action name</FieldHint>
          </div>
          <div>
            <FieldLabel required>Which contact field to be updated</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] text-left">
                  <span className={active.fieldKey ? "text-gray-800" : "text-gray-300"}>
                    {CONTACT_FIELD_OPTIONS.find((o) => o.key === active.fieldKey)?.label ?? "Please Select"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {CONTACT_FIELD_OPTIONS.map((o) => (
                  <DropdownMenuItem key={o.key} onClick={() => update(active.id, { fieldKey: o.key })} className="text-xs">{o.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {touched && !active.fieldKey ? (
              <p className="text-[11px] text-red-500 mt-1">Contact field is required.</p>
            ) : (
              <FieldHint>Choose the contact field to be updated</FieldHint>
            )}
          </div>
          <div className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-gray-500"><span className="font-semibold">Note:</span> For Name, Email or Phone; skip this action and add the information directly into your prompt. <span className="text-primary">(Learn More)</span></p>
          </div>
          <div>
            <FieldLabel required>What to update in the field</FieldLabel>
            <TextInput placeholder="Eg: birthdate of the contact" value={active.instruction} onChange={(e) => update(active.id, { instruction: e.target.value })} />
            {touched && !active.instruction.trim() ? (
              <p className="text-[11px] text-red-500 mt-1">This field is required.</p>
            ) : (
              <FieldHint>Provide what information the AI Employee should find and update in the contact record</FieldHint>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => removeField(active.id)} className="text-red-500 gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
        </div>
      </div>
    </ModalShell>
  );
}

// ══════════════════════════════════════════════════════════
// STOP BOT
// ══════════════════════════════════════════════════════════
type StopBotScenario = Scenario & {
  triggerCondition: string; examplePhrases: string[];
  finalMessage: string; reactivateEnabled: boolean; reactivateValue: number; reactivateUnit: string;
  tagIds: string[];
};
export type StopBotConfig = { scenarios: StopBotScenario[] };

function defaultStopBotScenarios(): StopBotScenario[] {
  return [
    { id: uid(), name: "Goodbye Detection", enabled: false, triggerCondition: "When the contact says goodbye or similar phrases", examplePhrases: ["Bye", "Goodbye", "Thank you! have a nice day"], finalMessage: "Thank you for your time, Have a nice day.", reactivateEnabled: true, reactivateValue: 24, reactivateUnit: "Hours", tagIds: [] },
  ];
}

export function StopBotModal({ initial, tags, onClose, onSave }: {
  initial?: StopBotConfig; tags: WTag[]; onClose: () => void; onSave: (c: StopBotConfig) => Promise<void>;
}) {
  const [scenarios, setScenarios] = useState<StopBotScenario[]>(initial?.scenarios?.length ? initial.scenarios : defaultStopBotScenarios());
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const [phraseInput, setPhraseInput] = useState("");
  const [saving, setSaving] = useState(false);
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];

  function update(id: string, patch: Partial<StopBotScenario>) {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addScenario() {
    const s: StopBotScenario = { id: uid(), name: `Escenario ${scenarios.length + 1}`, enabled: false, triggerCondition: "", examplePhrases: [], finalMessage: "", reactivateEnabled: true, reactivateValue: 24, reactivateUnit: "Hours", tagIds: [] };
    setScenarios((prev) => [...prev, s]);
    setActiveId(s.id);
  }
  function addPhrase() {
    if (!phraseInput.trim()) return;
    update(active.id, { examplePhrases: [...active.examplePhrases, phraseInput.trim()] });
    setPhraseInput("");
  }
  function toggleTag(tagId: string) {
    const next = active.tagIds.includes(tagId) ? active.tagIds.filter((t) => t !== tagId) : [...active.tagIds, tagId];
    update(active.id, { tagIds: next });
  }
  async function handleSave() {
    setSaving(true);
    await onSave({ scenarios });
    setSaving(false);
  }

  return (
    <ModalShell icon={Ban} title="Stop Bot" subtitle={<>Stops responding to the Contact when the Scenarios occur. <span className="text-primary">(Learn More)</span></>} onClose={onClose} width={700}
      footer={<>
        <button onClick={addScenario} className="flex items-center gap-1.5 text-[12px] text-primary font-medium"><Plus className="h-3.5 w-3.5" /> New Scenario</button>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={saving} onClick={handleSave}>{saving ? "Guardando…" : "Save"}</Button></div>
      </>}>
      <ScenarioSidebarShell scenarios={scenarios} activeId={activeId} onSelectScenario={setActiveId}>
        <label className="flex items-center gap-2 text-[12.5px] font-medium text-gray-700 mb-3">
          <Toggle value={active.enabled} onChange={(v) => update(active.id, { enabled: v })} /> Enable scenario
        </label>
        <div className="space-y-3">
          <div>
            <FieldLabel required>Scenario name</FieldLabel>
            <TextInput value={active.name} onChange={(e) => update(active.id, { name: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Trigger Condition</FieldLabel>
            <TextInput value={active.triggerCondition} onChange={(e) => update(active.id, { triggerCondition: e.target.value })} />
            <FieldHint>Clearly define the scenario and situation when you want the bot to stop</FieldHint>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[12px] font-semibold text-gray-700 mb-1.5">Example Phrases</p>
            <p className="text-[11px] text-gray-400 mb-2">Add example phrases that trigger this scenario.</p>
            <div className="space-y-1.5 mb-2">
              {active.examplePhrases.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TextInput value={p} onChange={(e) => {
                    const next = [...active.examplePhrases]; next[i] = e.target.value; update(active.id, { examplePhrases: next });
                  }} className="bg-white" />
                  <button onClick={() => update(active.id, { examplePhrases: active.examplePhrases.filter((_, idx) => idx !== i) })} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <TextInput value={phraseInput} onChange={(e) => setPhraseInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhrase(); } }} placeholder="Escribe una frase…" className="bg-white" />
              <Button size="sm" variant="outline" onClick={addPhrase}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            <button onClick={addPhrase} className="flex items-center gap-1 text-[11.5px] text-primary font-medium mt-1.5"><Plus className="h-3 w-3" /> Add Example Phrase</button>
          </div>
          <div>
            <FieldLabel>Final Message</FieldLabel>
            <TextArea rows={2} value={active.finalMessage} onChange={(e) => update(active.id, { finalMessage: e.target.value })} />
            <FieldHint>This is the final message the bot will send before going to sleep</FieldHint>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-gray-700">
            <input type="checkbox" checked={active.reactivateEnabled} onChange={(e) => update(active.id, { reactivateEnabled: e.target.checked })} className="accent-primary h-3.5 w-3.5" />
            Reactivate bot after <Info className="h-3 w-3 text-gray-300" />
            <TextInput type="number" min={0} value={active.reactivateValue} onChange={(e) => update(active.id, { reactivateValue: Number(e.target.value) })} className="w-16 py-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="border border-gray-200 rounded-lg px-2 py-1 text-[12px] text-gray-600 flex items-center gap-1">{active.reactivateUnit} <ChevronDown className="h-3 w-3" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {["Minutes", "Hours", "Days"].map((u) => <DropdownMenuItem key={u} onClick={() => update(active.id, { reactivateUnit: u })} className="text-xs">{u}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </label>
          <div>
            <FieldLabel>Add custom tags (optional)</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex flex-wrap items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 min-h-[38px] text-left">
                  {active.tagIds.length === 0
                    ? <span className="text-[12px] text-gray-300">Seleccionar etiquetas…</span>
                    : active.tagIds.map((tid) => {
                      const tag = tags.find((t) => t.id === tid);
                      return tag ? <span key={tid} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${tag.color}18`, color: tag.color }}>{tag.name}</span> : null;
                    })}
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {tags.length === 0 && <p className="text-[11px] text-gray-400 px-2 py-3 text-center">Sin etiquetas — créalas desde una propiedad o lead</p>}
                {tags.map((t) => (
                  <DropdownMenuItem key={t.id} onSelect={(e) => e.preventDefault()} onClick={() => toggleTag(t.id)} className="text-xs gap-2">
                    <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center", active.tagIds.includes(t.id) ? "bg-primary border-primary" : "border-gray-300")}>
                      {active.tagIds.includes(t.id) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <FieldHint>Add a tag to contact after bot is stopped</FieldHint>
          </div>
        </div>
      </ScenarioSidebarShell>
    </ModalShell>
  );
}

// ══════════════════════════════════════════════════════════
// HUMAN HANDOVER
// ══════════════════════════════════════════════════════════
type HandoverScenario = Scenario & {
  triggerCondition: string; examplePhrases: string[]; assignToUserId: string;
  finalMessage: string; reactivateEnabled: boolean; reactivateValue: number; reactivateUnit: string;
  createTask: boolean; tagIds: string[];
};
export type HumanHandoverConfig = { scenarios: HandoverScenario[] };

function defaultHandoverScenarios(): HandoverScenario[] {
  return [
    { id: uid(), name: "Human Requested", enabled: false, triggerCondition: "Direct request to speak with human", examplePhrases: ["I want to talk to the manager", "I want to talk to a human"], assignToUserId: "", finalMessage: "Sure! I'm transferring your request to a human agent. Someone from the team will be with you shortly.", reactivateEnabled: true, reactivateValue: 8, reactivateUnit: "Hours", createTask: true, tagIds: [] },
    { id: uid(), name: "Lack of information", enabled: false, triggerCondition: "The AI cannot find the relevant information or lacks knowledge on the query", examplePhrases: [], assignToUserId: "", finalMessage: "I'm sorry, but I don't have the answer to your question at the moment. I've escalated this to the team.", reactivateEnabled: true, reactivateValue: 8, reactivateUnit: "Hours", createTask: true, tagIds: [] },
    { id: uid(), name: "Failed to resolve issue", enabled: false, triggerCondition: "Multiple attempts to resolve the issue has failed", examplePhrases: [], assignToUserId: "", finalMessage: "Apologies, but I'm unable to process your request currently. I've escalated it to a team member.", reactivateEnabled: true, reactivateValue: 8, reactivateUnit: "Hours", createTask: true, tagIds: [] },
  ];
}

export function HumanHandoverModal({ initial, users, tags, onClose, onSave }: {
  initial?: HumanHandoverConfig; users: WUser[]; tags: WTag[]; onClose: () => void; onSave: (c: HumanHandoverConfig) => Promise<void>;
}) {
  const [scenarios, setScenarios] = useState<HandoverScenario[]>(initial?.scenarios?.length ? initial.scenarios : defaultHandoverScenarios());
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const [phraseInput, setPhraseInput] = useState("");
  const [saving, setSaving] = useState(false);
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];

  function update(id: string, patch: Partial<HandoverScenario>) {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addScenario() {
    const s: HandoverScenario = { id: uid(), name: `Escenario ${scenarios.length + 1}`, enabled: false, triggerCondition: "", examplePhrases: [], assignToUserId: "", finalMessage: "", reactivateEnabled: true, reactivateValue: 8, reactivateUnit: "Hours", createTask: false, tagIds: [] };
    setScenarios((prev) => [...prev, s]);
    setActiveId(s.id);
  }
  function addPhrase() {
    if (!phraseInput.trim()) return;
    update(active.id, { examplePhrases: [...active.examplePhrases, phraseInput.trim()] });
    setPhraseInput("");
  }
  function toggleTag(tagId: string) {
    const next = active.tagIds.includes(tagId) ? active.tagIds.filter((t) => t !== tagId) : [...active.tagIds, tagId];
    update(active.id, { tagIds: next });
  }
  async function handleSave() {
    setSaving(true);
    await onSave({ scenarios });
    setSaving(false);
  }

  return (
    <ModalShell icon={UserPlus} title="Human Handover" subtitle={<>Assign conversation to a human when any enabled scenario occurs. <span className="text-primary">(Learn More)</span></>} onClose={onClose} width={700}
      footer={<>
        <button onClick={addScenario} className="flex items-center gap-1.5 text-[12px] text-primary font-medium"><Plus className="h-3.5 w-3.5" /> New Scenario</button>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={saving} onClick={handleSave}>{saving ? "Guardando…" : "Save"}</Button></div>
      </>}>
      <ScenarioSidebarShell scenarios={scenarios} activeId={activeId} onSelectScenario={setActiveId}>
        <label className="flex items-center gap-2 text-[12.5px] font-medium text-gray-700 mb-3">
          <Toggle value={active.enabled} onChange={(v) => update(active.id, { enabled: v })} /> Enable scenario
        </label>
        <div className="space-y-3">
          <div>
            <FieldLabel required>Scenario name</FieldLabel>
            <TextInput value={active.name} onChange={(e) => update(active.id, { name: e.target.value })} />
          </div>
          <div>
            <FieldLabel required>Trigger Condition</FieldLabel>
            <TextInput value={active.triggerCondition} onChange={(e) => update(active.id, { triggerCondition: e.target.value })} />
            <FieldHint>Define when the bot should handover the conversation to a human</FieldHint>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[12px] font-semibold text-gray-700 mb-1.5">Example Phrases</p>
            <p className="text-[11px] text-gray-400 mb-2">Add example phrases that trigger this scenario.</p>
            <div className="space-y-1.5 mb-2">
              {active.examplePhrases.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TextInput value={p} onChange={(e) => {
                    const next = [...active.examplePhrases]; next[i] = e.target.value; update(active.id, { examplePhrases: next });
                  }} className="bg-white" />
                  <button onClick={() => update(active.id, { examplePhrases: active.examplePhrases.filter((_, idx) => idx !== i) })} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <TextInput value={phraseInput} onChange={(e) => setPhraseInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhrase(); } }} placeholder="Escribe una frase…" className="bg-white" />
              <Button size="sm" variant="outline" onClick={addPhrase}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            <button onClick={addPhrase} className="flex items-center gap-1 text-[11.5px] text-primary font-medium mt-1.5"><Plus className="h-3 w-3" /> Add Example Phrase</button>
          </div>
          <div>
            <FieldLabel required>Assign Conversation to a Specific User</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] text-left">
                  <span className={active.assignToUserId ? "text-gray-800" : "text-gray-300"}>{users.find((u) => u.id === active.assignToUserId)?.name ?? "Select User"}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {users.length === 0 && <p className="text-[11px] text-gray-400 px-2 py-3 text-center">Sin usuarios</p>}
                {users.map((u) => <DropdownMenuItem key={u.id} onClick={() => update(active.id, { assignToUserId: u.id })} className="text-xs">{u.name}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <FieldLabel required>Final Message</FieldLabel>
            <TextArea rows={2} value={active.finalMessage} onChange={(e) => update(active.id, { finalMessage: e.target.value })} />
            <FieldHint>This is the final message the bot will send before going to sleep</FieldHint>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-gray-700">
            <input type="checkbox" checked={active.reactivateEnabled} onChange={(e) => update(active.id, { reactivateEnabled: e.target.checked })} className="accent-primary h-3.5 w-3.5" />
            Reactivate bot after <Info className="h-3 w-3 text-gray-300" />
            <TextInput type="number" min={0} value={active.reactivateValue} onChange={(e) => update(active.id, { reactivateValue: Number(e.target.value) })} className="w-16 py-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="border border-gray-200 rounded-lg px-2 py-1 text-[12px] text-gray-600 flex items-center gap-1">{active.reactivateUnit} <ChevronDown className="h-3 w-3" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {["Minutes", "Hours", "Days"].map((u) => <DropdownMenuItem key={u} onClick={() => update(active.id, { reactivateUnit: u })} className="text-xs">{u}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-gray-700">
            <input type="checkbox" checked={active.createTask} onChange={(e) => update(active.id, { createTask: e.target.checked })} className="accent-primary h-3.5 w-3.5" />
            Create a task on the contact <Info className="h-3 w-3 text-gray-300" />
          </label>
          <div>
            <FieldLabel>Add custom tags (optional)</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex flex-wrap items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 min-h-[38px] text-left">
                  {active.tagIds.length === 0
                    ? <span className="text-[12px] text-gray-300">Seleccionar etiquetas…</span>
                    : active.tagIds.map((tid) => {
                      const tag = tags.find((t) => t.id === tid);
                      return tag ? <span key={tid} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${tag.color}18`, color: tag.color }}>{tag.name}</span> : null;
                    })}
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {tags.length === 0 && <p className="text-[11px] text-gray-400 px-2 py-3 text-center">Sin etiquetas — créalas desde una propiedad o lead</p>}
                {tags.map((t) => (
                  <DropdownMenuItem key={t.id} onSelect={(e) => e.preventDefault()} onClick={() => toggleTag(t.id)} className="text-xs gap-2">
                    <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center", active.tagIds.includes(t.id) ? "bg-primary border-primary" : "border-gray-300")}>
                      {active.tagIds.includes(t.id) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <FieldHint>Add a tag to contact after human handover is completed</FieldHint>
          </div>
        </div>
      </ScenarioSidebarShell>
    </ModalShell>
  );
}

// ══════════════════════════════════════════════════════════
// BOT TRANSFER
// ══════════════════════════════════════════════════════════
type TransferScenario = Scenario & { transferToBotId: string; triggerCondition: string };
export type BotTransferConfig = { scenarios: TransferScenario[] };

export function BotTransferModal({ initial, otherAgents, currentAgentSummary, onClose, onSave }: {
  initial?: BotTransferConfig; otherAgents: OtherAgent[]; currentAgentSummary: { status: string; channels: string[] };
  onClose: () => void; onSave: (c: BotTransferConfig) => Promise<void>;
}) {
  const [scenarios, setScenarios] = useState<TransferScenario[]>(
    initial?.scenarios?.length ? initial.scenarios : [{ id: uid(), name: "Default Transfer Bot", enabled: false, transferToBotId: "", triggerCondition: "" }]
  );
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const [saving, setSaving] = useState(false);
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
  const selectedBot = otherAgents.find((a) => a.id === active.transferToBotId);

  function update(id: string, patch: Partial<TransferScenario>) {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addScenario() {
    const s: TransferScenario = { id: uid(), name: `Bot Transfer ${scenarios.length + 1}`, enabled: false, transferToBotId: "", triggerCondition: "" };
    setScenarios((prev) => [...prev, s]);
    setActiveId(s.id);
  }
  async function handleSave() {
    setSaving(true);
    await onSave({ scenarios });
    setSaving(false);
  }

  return (
    <ModalShell icon={ArrowRightLeft} title="Bot Transfer" subtitle={<>Transfer the Conversation to another Agent <span className="text-primary">(Learn More)</span></>} onClose={onClose} width={680}
      footer={<>
        <button onClick={addScenario} className="flex items-center gap-1.5 text-[12px] text-primary font-medium"><Plus className="h-3.5 w-3.5" /> New Bot Transfer</button>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={saving} onClick={handleSave}>{saving ? "Guardando…" : "Save"}</Button></div>
      </>}>
      <ScenarioSidebarShell scenarios={scenarios} activeId={activeId} onSelectScenario={setActiveId}>
        <label className="flex items-center gap-2 text-[12.5px] font-medium text-gray-700 mb-3">
          <Toggle value={active.enabled} onChange={(v) => update(active.id, { enabled: v })} /> Enable Scenario
        </label>
        <div className="space-y-3">
          <div>
            <FieldLabel required>Action name</FieldLabel>
            <TextInput value={active.name} onChange={(e) => update(active.id, { name: e.target.value })} />
            <FieldHint>Enter Action Name</FieldHint>
          </div>
          <div>
            <FieldLabel>Select Bot to Transfer to <Info className="h-3 w-3 text-gray-300 inline" /></FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] text-left">
                  <span className={selectedBot ? "text-gray-800" : "text-gray-300"}>{selectedBot ? `${selectedBot.name}${selectedBot.isPrimary ? " (Primary)" : ""}` : "Select a bot…"}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {otherAgents.length === 0 && <p className="text-[11px] text-gray-400 px-2 py-3 text-center">Crea otro agente primero</p>}
                {otherAgents.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={() => update(active.id, { transferToBotId: a.id })} className="text-xs">
                    {a.name}{a.isPrimary ? " (Primary)" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Current Bot</p>
              <p className="text-[11px] text-gray-500">Status: <span className="text-gray-700">{currentAgentSummary.status}</span></p>
              <p className="text-[11px] text-gray-500">Selected Channel: <span className="text-gray-700">{currentAgentSummary.channels.join(", ") || "—"}</span></p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Selected Bot</p>
              <p className="text-[11px] text-gray-500">Status: <span className="text-gray-700">{selectedBot?.status ?? "—"}</span></p>
              <p className="text-[11px] text-gray-500">Selected Channel: <span className="text-gray-700">{selectedBot?.channels.join(", ") || "—"}</span></p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Make sure your Selected bot is active and compatible to selected channel</p>

          <div>
            <FieldLabel>Trigger Condition <Info className="h-3 w-3 text-gray-300 inline" /></FieldLabel>
            <TextInput value={active.triggerCondition} onChange={(e) => update(active.id, { triggerCondition: e.target.value })} placeholder="If bot doesn't know the answer" />
            <FieldHint>Define when the bot should take custom actions based on contact&apos;s messages</FieldHint>
          </div>
        </div>
      </ScenarioSidebarShell>
    </ModalShell>
  );
}

// ══════════════════════════════════════════════════════════
// AUTO FOLLOW-UP (+ nested Follow-up Settings)
// ══════════════════════════════════════════════════════════
type FollowupStep = { id: string; value: number; unit: "Minutes" | "Hours" | "Days"; letAiSend: boolean; triggerWorkflow: boolean };
type FollowupScenario = Scenario & { followUps: FollowupStep[] };
type DayRange = { from: string; to: string };
type DaySchedule = { enabled: boolean; ranges: DayRange[] };
export type AutoFollowupConfig = {
  scenarios: FollowupScenario[];
  settings: {
    activeHoursEnabled: boolean; timezone: "CONTACT" | "BUSINESS";
    schedule: Record<string, DaySchedule>; dynamicChannelSwitching: boolean;
  };
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function defaultFollowupScenarios(): FollowupScenario[] {
  return [
    { id: uid(), name: "Contact Stopped Replying", enabled: false, followUps: [{ id: uid(), value: 15, unit: "Minutes", letAiSend: true, triggerWorkflow: false }] },
    { id: uid(), name: "Contact is Busy", enabled: false, followUps: [{ id: uid(), value: 2, unit: "Hours", letAiSend: true, triggerWorkflow: false }] },
    { id: uid(), name: "Contact Requested", enabled: false, followUps: [{ id: uid(), value: 1, unit: "Hours", letAiSend: true, triggerWorkflow: false }] },
  ];
}
function defaultSchedule(): Record<string, DaySchedule> {
  const s: Record<string, DaySchedule> = {};
  for (const d of DAYS) s[d] = { enabled: !["Sat", "Sun"].includes(d), ranges: [{ from: "08:00 AM", to: "05:00 PM" }] };
  return s;
}

function FollowupSettingsModal({ initial, onBack, onClose, onSave }: {
  initial: AutoFollowupConfig["settings"]; onBack: () => void; onClose: () => void;
  onSave: (s: AutoFollowupConfig["settings"]) => void;
}) {
  const [activeHoursEnabled, setActiveHoursEnabled] = useState(initial.activeHoursEnabled);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [schedule, setSchedule] = useState(initial.schedule && Object.keys(initial.schedule).length ? initial.schedule : defaultSchedule());
  const [dynamicChannelSwitching, setDynamicChannelSwitching] = useState(initial.dynamicChannelSwitching);

  function updateDay(day: string, patch: Partial<DaySchedule>) {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  return (
    <ModalShell icon={RotateCcw} title="Follow-up Settings" subtitle="" onClose={onClose} width={460}
      footer={<><Button variant="outline" size="sm" onClick={onBack}>Back</Button><div className="flex gap-2"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={() => onSave({ activeHoursEnabled, timezone, schedule, dynamicChannelSwitching })}>Save</Button></div></>}>
      <div className="px-5 py-4 space-y-4">
        <div>
          <p className="text-[12.5px] font-semibold text-gray-700 mb-2">Follow-up Hours</p>
          <label className="flex items-center gap-2 text-[12.5px] text-gray-700">
            <Toggle value={activeHoursEnabled} onChange={setActiveHoursEnabled} /> Set Active Hours for Follow-up <Info className="h-3 w-3 text-gray-300" />
          </label>
        </div>

        {activeHoursEnabled && (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Timezone <Info className="h-3 w-3 text-gray-300 inline" /></p>
              <div className="flex gap-4">
                {(["CONTACT", "BUSINESS"] as const).map((tz) => (
                  <label key={tz} className="flex items-center gap-1.5 text-[12px] text-gray-700 cursor-pointer">
                    <input type="radio" checked={timezone === tz} onChange={() => setTimezone(tz)} className="accent-primary" />
                    {tz === "CONTACT" ? "Contact Timezone" : "Business Timezone"}
                  </label>
                ))}
              </div>
            </div>
            <div className="max-h-[260px] overflow-y-auto space-y-3 pr-1">
              {DAYS.map((day) => (
                <div key={day}>
                  <label className="flex items-center gap-2 text-[12.5px] font-medium text-gray-700 mb-1.5">
                    <input type="checkbox" checked={schedule[day]?.enabled ?? false} onChange={(e) => updateDay(day, { enabled: e.target.checked })} className="accent-primary h-3.5 w-3.5" />
                    {day}
                  </label>
                  {schedule[day]?.enabled && schedule[day].ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 mb-1.5">
                      <TextInput value={r.from} onChange={(e) => {
                        const ranges = [...schedule[day].ranges]; ranges[i] = { ...ranges[i], from: e.target.value }; updateDay(day, { ranges });
                      }} className="w-24 text-[11px]" />
                      <span className="text-[10px] text-gray-400">to</span>
                      <TextInput value={r.to} onChange={(e) => {
                        const ranges = [...schedule[day].ranges]; ranges[i] = { ...ranges[i], to: e.target.value }; updateDay(day, { ranges });
                      }} className="w-24 text-[11px]" />
                      <button onClick={() => updateDay(day, { ranges: schedule[day].ranges.filter((_, idx) => idx !== i) })} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                      <button onClick={() => updateDay(day, { ranges: [...schedule[day].ranges, { from: "08:00 AM", to: "05:00 PM" }] })} className="text-gray-300 hover:text-primary"><Plus className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <label className="flex items-start gap-2 text-[12px] text-gray-700 pt-1 border-t border-gray-100">
              <Toggle value={dynamicChannelSwitching} onChange={setDynamicChannelSwitching} />
              <span>
                Dynamic Channel Switching
                <span className="block text-[11px] text-gray-400">Dynamic Channel Switching ensures your follow-ups continue, even if a contact becomes inactive on a specific channel. <span className="text-primary">Read more</span></span>
              </span>
            </label>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

export function AutoFollowupModal({ initial, onClose, onSave }: {
  initial?: AutoFollowupConfig; onClose: () => void; onSave: (c: AutoFollowupConfig) => Promise<void>;
}) {
  const [scenarios, setScenarios] = useState<FollowupScenario[]>(initial?.scenarios?.length ? initial.scenarios : defaultFollowupScenarios());
  const [settings, setSettings] = useState(initial?.settings ?? { activeHoursEnabled: false, timezone: "CONTACT" as const, schedule: defaultSchedule(), dynamicChannelSwitching: false });
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];

  function update(id: string, patch: Partial<FollowupScenario>) {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addScenario() {
    const s: FollowupScenario = { id: uid(), name: `Escenario ${scenarios.length + 1}`, enabled: false, followUps: [{ id: uid(), value: 15, unit: "Minutes", letAiSend: true, triggerWorkflow: false }] };
    setScenarios((prev) => [...prev, s]);
    setActiveId(s.id);
  }
  function addFollowup() {
    if (active.followUps.length >= 5) return;
    update(active.id, { followUps: [...active.followUps, { id: uid(), value: 1, unit: "Hours", letAiSend: true, triggerWorkflow: false }] });
  }
  function updateFollowup(fid: string, patch: Partial<FollowupStep>) {
    update(active.id, { followUps: active.followUps.map((f) => (f.id === fid ? { ...f, ...patch } : f)) });
  }
  async function handleSave() {
    setSaving(true);
    await onSave({ scenarios, settings });
    setSaving(false);
  }

  if (showSettings) {
    return (
      <FollowupSettingsModal
        initial={settings}
        onBack={() => setShowSettings(false)}
        onClose={onClose}
        onSave={(s) => { setSettings(s); setShowSettings(false); }}
      />
    );
  }

  return (
    <ModalShell icon={RotateCcw} title="Auto Follow-up" subtitle={<>Bot will follow-up with the contact in given time sequence <span className="text-primary">(Learn More)</span></>} onClose={onClose} width={700}
      footer={
        <>
          <div className="flex items-center gap-3">
            <button onClick={addScenario} className="flex items-center gap-1.5 text-[12px] text-primary font-medium"><Plus className="h-3.5 w-3.5" /> New Scenario</button>
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-primary">
              <ArrowRightLeft className="h-3.5 w-3.5 rotate-90" /> Follow-up Settings
            </button>
          </div>
          <div className="flex gap-2"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={saving} onClick={handleSave}>{saving ? "Guardando…" : "Save"}</Button></div>
        </>
      }>
      <ScenarioSidebarShell scenarios={scenarios} activeId={activeId} onSelectScenario={setActiveId}>
        <label className="flex items-center gap-2 text-[12.5px] font-medium text-gray-700 mb-3">
          <Toggle value={active.enabled} onChange={(v) => update(active.id, { enabled: v })} /> Enable scenario
        </label>
        <FieldLabel required>Scenario name</FieldLabel>
        <TextInput value={active.name} onChange={(e) => update(active.id, { name: e.target.value })} className="mb-4" />

        <p className="text-[12px] font-semibold text-gray-700 mb-0.5">Follow-up Sequence</p>
        <p className="text-[11px] text-gray-400 mb-2">Configure up to 5 followups</p>
        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
          {active.followUps.map((f, i) => (
            <div key={f.id} className={cn(i > 0 && "pt-3 border-t border-gray-200")}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11.5px] font-semibold text-gray-600">Follow-up {i + 1} <Info className="h-3 w-3 text-gray-300 inline" /></p>
                <button onClick={() => update(active.id, { followUps: active.followUps.filter((x) => x.id !== f.id) })} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <TextInput type="number" min={1} value={f.value} onChange={(e) => updateFollowup(f.id, { value: Number(e.target.value) })} className="w-20 bg-white" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="border border-gray-200 rounded-lg px-3 py-2 text-[12px] bg-white text-gray-600 flex items-center gap-1">{f.unit} <ChevronDown className="h-3 w-3" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(["Minutes", "Hours", "Days"] as const).map((u) => <DropdownMenuItem key={u} onClick={() => updateFollowup(f.id, { unit: u })} className="text-xs">{u}</DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-[11.5px] text-gray-600"><input type="checkbox" checked={f.letAiSend} onChange={(e) => updateFollowup(f.id, { letAiSend: e.target.checked })} className="accent-primary h-3.5 w-3.5" /> Let AI Send The Message <Info className="h-3 w-3 text-gray-300" /></label>
                <label className="flex items-center gap-1.5 text-[11.5px] text-gray-600"><input type="checkbox" checked={f.triggerWorkflow} onChange={(e) => updateFollowup(f.id, { triggerWorkflow: e.target.checked })} className="accent-primary h-3.5 w-3.5" /> Trigger Workflow <Info className="h-3 w-3 text-gray-300" /></label>
              </div>
            </div>
          ))}
        </div>
        {active.followUps.length < 5 && (
          <button onClick={addFollowup} className="flex items-center gap-1.5 text-[12px] text-primary font-medium mt-2"><Plus className="h-3.5 w-3.5" /> Add Follow-up</button>
        )}
      </ScenarioSidebarShell>
    </ModalShell>
  );
}

// ══════════════════════════════════════════════════════════
// TOOL KIT
// ══════════════════════════════════════════════════════════
export type AgentToolItem = {
  id: string; key: string; name: string; description: string; category: string;
  method: string; examplePrompt: string | null; isBuiltIn: boolean;
};

const TOOL_ICON: Record<string, React.ElementType> = {
  book_appointment: CalendarCheck, create_note: StickyNote, create_task: ListChecks,
  enviar_informacion: TagIcon, get_availability: Clock3, get_user_calendar_events: CalendarClock,
  scrape_website: Globe, search_the_web: Search, self_schedule: CalendarClock,
  send_email: Mail, update_appointment_details: CalendarCheck, update_user_details: UserCog,
  remove_tag: TagIcon,
};

const TOOL_CATEGORIES = ["PLATFORM", "EXTRACTION", "TRANSFER", "ADD_TAG", "REMOVE_TAG", "CUSTOM", "WORKFLOWS"];
const TOOL_CATEGORY_LABEL: Record<string, string> = {
  PLATFORM: "Platform", EXTRACTION: "Extraction", TRANSFER: "Transfer",
  ADD_TAG: "Add tag", REMOVE_TAG: "Remove tag", CUSTOM: "Custom", WORKFLOWS: "Workflows",
};

function ToolCard({ tool, assigned, onToggle }: { tool: AgentToolItem; assigned: boolean; onToggle: () => void }) {
  const Icon = TOOL_ICON[tool.key] ?? Wrench;
  return (
    <div className={cn("relative rounded-xl border p-3.5 flex flex-col gap-1.5", assigned ? "border-primary/40 bg-primary/[0.03]" : "border-gray-200")}>
      <div className="flex items-center justify-between">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <button onClick={onToggle} title={assigned ? "Quitar" : "Asignar"}
          className={cn("h-6 w-6 rounded-full flex items-center justify-center border transition-colors",
            assigned ? "bg-primary border-primary text-white" : "border-gray-300 text-transparent hover:border-primary")}>
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-[12.5px] font-semibold text-gray-800">{tool.name}</p>
      <p className="text-[11px] text-gray-500 leading-snug">{tool.description}</p>
      {tool.examplePrompt && <p className="text-[10.5px] text-gray-400 italic">&quot;{tool.examplePrompt}&quot;</p>}
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{TOOL_CATEGORY_LABEL[tool.category] ?? tool.category}</span>
        {assigned && <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase">Assigned</span>}
        <span className="text-[9px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase">{tool.method}</span>
      </div>
    </div>
  );
}

export function ToolKitModal({ tools, assignedIds, onClose, onToggleAssign, onCreateCustom, onDeleteCustom }: {
  tools: AgentToolItem[]; assignedIds: string[]; onClose: () => void;
  onToggleAssign: (toolId: string) => void;
  onCreateCustom: (data: { name: string; description: string; category: string; examplePrompt?: string }) => Promise<void>;
  onDeleteCustom: (toolId: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "">("");
  const [showNewTool, setShowNewTool] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("CUSTOM");
  const [newExample, setNewExample] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = tools.filter((t) => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const assigned = filtered.filter((t) => assignedIds.includes(t.id));
  const library = filtered.filter((t) => !assignedIds.includes(t.id));

  async function handleCreate() {
    if (!newName.trim() || !newDesc.trim()) return;
    setCreating(true);
    await onCreateCustom({ name: newName.trim(), description: newDesc.trim(), category: newCategory, examplePrompt: newExample.trim() || undefined });
    setCreating(false);
    setShowNewTool(false);
    setNewName(""); setNewDesc(""); setNewExample(""); setNewCategory("CUSTOM");
  }

  return (
    <ModalShell icon={Wrench} title="Tool Kit" subtitle={`${assigned.length} of ${tools.length} assigned`} onClose={onClose} width={860}
      footer={<><div /><Button size="sm" variant="outline" onClick={onClose}>Cerrar</Button></>}>
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tools"
              className="pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-primary w-[180px]" />
          </div>
          <button onClick={() => setCategoryFilter("")} className={cn("text-[11.5px] font-medium px-3 py-1.5 rounded-full border", !categoryFilter ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600")}>All</button>
          {TOOL_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)} className={cn("text-[11.5px] font-medium px-3 py-1.5 rounded-full border", categoryFilter === c ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600")}>
              {TOOL_CATEGORY_LABEL[c]}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-[12px] gap-1.5" disabled><Download className="h-3.5 w-3.5" /> Import</Button>
            <Button size="sm" className="text-[12px] gap-1.5" onClick={() => setShowNewTool((v) => !v)}><Plus className="h-3.5 w-3.5" /> New tool</Button>
          </div>
        </div>

        {showNewTool && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50/60 space-y-2.5">
            <p className="text-[12.5px] font-semibold text-gray-700">Nueva tool personalizada</p>
            <TextInput placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-white" />
            <TextArea rows={2} placeholder="Descripción" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="bg-white" />
            <TextInput placeholder="Frase de ejemplo (opcional)" value={newExample} onChange={(e) => setNewExample(e.target.value)} className="bg-white" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="border border-gray-200 rounded-lg px-3 py-2 text-[12px] bg-white text-gray-600 flex items-center gap-1.5">{TOOL_CATEGORY_LABEL[newCategory]} <ChevronDown className="h-3 w-3" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {TOOL_CATEGORIES.map((c) => <DropdownMenuItem key={c} onClick={() => setNewCategory(c)} className="text-xs">{TOOL_CATEGORY_LABEL[c]}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowNewTool(false)}>Cancelar</Button>
              <Button size="sm" disabled={creating || !newName.trim() || !newDesc.trim()} onClick={handleCreate}>{creating ? "Creando…" : "Crear tool"}</Button>
            </div>
          </div>
        )}

        {assigned.length > 0 && (
          <>
            <p className="text-[11.5px] font-semibold text-primary mb-2">● Assigned to this assistant <span className="text-gray-400 font-normal">{assigned.length}</span></p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {assigned.map((t) => (
                <div key={t.id} className="relative group">
                  <ToolCard tool={t} assigned onToggle={() => onToggleAssign(t.id)} />
                  {!t.isBuiltIn && (
                    <button onClick={() => onDeleteCustom(t.id)} className="absolute top-2 left-2 text-gray-300 hover:text-red-500 bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Library</p>
        {library.length === 0 ? (
          <p className="text-[12px] text-gray-300 py-6 text-center">Todas las tools coincidentes ya están asignadas.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {library.map((t) => (
              <div key={t.id} className="relative group">
                <ToolCard tool={t} assigned={false} onToggle={() => onToggleAssign(t.id)} />
                {!t.isBuiltIn && (
                  <button onClick={() => onDeleteCustom(t.id)} className="absolute top-2 left-2 text-gray-300 hover:text-red-500 bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
