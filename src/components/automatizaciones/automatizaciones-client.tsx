"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Zap, Plus, Sparkles, ArrowRight, Trash2, MessageCircle, CheckSquare, Tag, ArrowRightCircle, UserPlus, Clock, Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  proposeAutomationFromText, createAutomationFromProposal, toggleAutomationActive, deleteAutomation,
  type AutomationProposal,
} from "@/app/actions/automations";
import { ModalShell } from "@/components/agentes/action-modals";

type AutomationActionRow = { id: string; order: number; type: string; config: unknown };
type Automation = {
  id: string; name: string; description: string | null; isActive: boolean;
  trigger: string; triggerConfig: unknown; actions: AutomationActionRow[]; createdAt: string;
};

const TRIGGER_LABEL: Record<string, string> = {
  LEAD_CREATED: "Se crea un lead nuevo",
  LEAD_STAGE_CHANGED: "Cambia la etapa de un lead",
  MESSAGE_RECEIVED: "Llega un mensaje",
  APPOINTMENT_CREATED: "Se agenda una cita",
  APPOINTMENT_REMINDER: "Recordatorio de cita",
  PROPERTY_SOLD: "Se vende una propiedad",
  TASK_DUE: "Una tarea vence",
  INACTIVITY: "Un lead lleva tiempo sin responder",
  CUSTOM: "Condición personalizada",
};

const ACTION_META: Record<string, { label: string; Icon: React.ElementType }> = {
  SEND_MESSAGE: { label: "Enviar mensaje", Icon: MessageCircle },
  CREATE_TASK: { label: "Crear tarea", Icon: CheckSquare },
  ADD_TAG: { label: "Agregar etiqueta", Icon: Tag },
  CHANGE_STAGE: { label: "Cambiar etapa", Icon: ArrowRightCircle },
  ASSIGN_USER: { label: "Asignar a agente", Icon: UserPlus },
  WAIT: { label: "Esperar", Icon: Clock },
  NOTIFY_TEAM: { label: "Notificar al equipo", Icon: Bell },
};

function describeAction(a: { type: string; config: unknown }) {
  const config = (a.config ?? {}) as Record<string, unknown>;
  switch (a.type) {
    case "SEND_MESSAGE": return `"${config.content ?? "…"}"`;
    case "CREATE_TASK": return `${config.title ?? "…"} (${config.priority ?? "MEDIA"})`;
    case "ADD_TAG": return `${config.tag ?? "…"}`;
    case "CHANGE_STAGE": return `a ${config.stage ?? "…"}`;
    case "WAIT": return `${config.hours ?? "?"} horas`;
    default: return "";
  }
}

export function AutomatizacionesClient({ workspaceId, automations }: { workspaceId: string; automations: Automation[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  async function handleToggle(id: string, isActive: boolean) {
    await toggleAutomationActive(id, isActive);
    router.refresh();
  }
  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta automatización?")) return;
    await deleteAutomation(id);
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Automatizaciones</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Describe en tus palabras qué quieres automatizar — el sistema arma el flujo por ti.</p>
          </div>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors">
            <Plus className="h-4 w-4" /> Nueva automatización
          </button>
        </div>

        {automations.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center text-center gap-2">
            <Zap className="h-10 w-10 text-gray-300" />
            <p className="text-[14px] font-semibold text-gray-700">Aún no tienes automatizaciones</p>
            <p className="text-[12.5px] text-muted-foreground max-w-sm">
              Ej: &quot;Cuando un lead lleva 3 días sin responder, envíale un mensaje de seguimiento por WhatsApp&quot;.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {automations.map((a) => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-semibold text-gray-900">{a.name}</p>
                      <span className={cn("text-[10.5px] font-medium rounded-full px-2 py-0.5", a.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {a.isActive ? "Activa" : "Pausada"}
                      </span>
                    </div>
                    {a.description && <p className="text-[12px] text-muted-foreground mt-0.5">{a.description}</p>}
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[11.5px]">
                      <span className="flex items-center gap-1 bg-violet-50 text-violet-700 rounded-full px-2.5 py-1 font-medium">
                        <Sparkles className="h-3 w-3" /> {TRIGGER_LABEL[a.trigger] ?? a.trigger}
                      </span>
                      {a.actions.map((act) => {
                        const meta = ACTION_META[act.type] ?? { label: act.type, Icon: Zap };
                        return (
                          <span key={act.id} className="flex items-center gap-1 text-gray-500">
                            <ArrowRight className="h-3 w-3 text-gray-300" />
                            <meta.Icon className="h-3 w-3" /> {meta.label} <span className="text-gray-400">{describeAction(act)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleToggle(a.id, !a.isActive)}
                      className={cn("text-[11.5px] font-medium rounded-full px-2.5 py-1 transition-colors",
                        a.isActive ? "text-gray-500 hover:bg-gray-100" : "text-green-700 bg-green-50 hover:bg-green-100")}>
                      {a.isActive ? "Pausar" : "Activar"}
                    </button>
                    <button onClick={() => handleDelete(a.id)} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <AutomationBuilderModal workspaceId={workspaceId} onClose={() => setModalOpen(false)}
            onCreated={() => { setModalOpen(false); router.refresh(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function AutomationBuilderModal({ workspaceId, onClose, onCreated }: { workspaceId: string; onClose: () => void; onCreated: () => void }) {
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<AutomationProposal | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!text.trim()) { setError("Describe qué quieres automatizar."); return; }
    setGenerating(true);
    setError("");
    const result = await proposeAutomationFromText(workspaceId, text.trim());
    setGenerating(false);
    if (!result.proposal) { setError(result.error ?? "Error desconocido."); return; }
    setProposal(result.proposal);
  }

  async function handleConfirm() {
    if (!proposal) return;
    setSaving(true);
    try {
      await createAutomationFromProposal(workspaceId, proposal);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la automatización.");
      setSaving(false);
    }
  }

  return (
    <ModalShell icon={Sparkles} iconColor="text-violet-600" iconBg="bg-violet-50"
      title="Nueva automatización" subtitle="Descríbela en texto libre, la IA arma el flujo" onClose={onClose}
      width={560}
      footer={proposal ? (
        <>
          <button onClick={() => setProposal(null)} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">
            Volver a editar
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {saving ? "Creando…" : "Crear automatización"}
          </button>
        </>
      ) : (
        <>
          <div />
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando…</> : <><Sparkles className="h-3.5 w-3.5" /> Generar</>}
          </button>
        </>
      )}>
      {!proposal ? (
        <div className="p-5 space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
            placeholder='Ej: "Cuando un lead lleva 3 días sin responder, envíale un mensaje de seguimiento por WhatsApp preguntando si sigue interesado."'
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary resize-none" />
          {error && <p className="text-[11.5px] text-red-500">{error}</p>}
        </div>
      ) : (
        <div className="p-5 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[13.5px] font-semibold text-gray-900">{proposal.name}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{proposal.description}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Cuándo</p>
            <span className="flex items-center gap-1.5 bg-violet-50 text-violet-700 rounded-lg px-3 py-2 text-[12.5px] font-medium w-fit">
              <Sparkles className="h-3.5 w-3.5" /> {TRIGGER_LABEL[proposal.trigger] ?? proposal.trigger}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Entonces</p>
            <div className="space-y-1.5">
              {proposal.actions.map((act, i) => {
                const meta = ACTION_META[act.type] ?? { label: act.type, Icon: Zap };
                return (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-[12.5px]">
                    <meta.Icon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                    <span className="font-medium text-gray-700">{meta.label}</span>
                    <span className="text-gray-400 truncate">{describeAction(act)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {error && <p className="text-[11.5px] text-red-500">{error}</p>}
        </div>
      )}
    </ModalShell>
  );
}
