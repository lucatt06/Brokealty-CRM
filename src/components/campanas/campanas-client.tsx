"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Megaphone, Plus, MessageCircle, MessageSquare, Camera, Mail, Pause, Play, Ban, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  createCampaign, updateCampaign, setCampaignStatus, deleteCampaign,
  type CampaignType, type CampaignChannel,
} from "@/app/actions/campaigns";
import { ModalShell, FieldLabel } from "@/components/agentes/action-modals";

type Campaign = {
  id: string; name: string; type: string; status: string; channel: string;
  subject: string | null; content: string;
  scheduledAt: string | null; sentAt: string | null;
  totalSent: number; delivered: number; opened: number; clicked: number; replied: number;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = { BROADCAST: "Difusión", SEQUENCE: "Secuencia", TRIGGER: "Disparador" };
const STATUS_META: Record<string, { label: string; className: string }> = {
  BORRADOR: { label: "Borrador", className: "bg-gray-100 text-gray-600" },
  PROGRAMADA: { label: "Programada", className: "bg-blue-100 text-blue-700" },
  ENVIANDO: { label: "Enviando", className: "bg-amber-100 text-amber-700" },
  COMPLETADA: { label: "Completada", className: "bg-green-100 text-green-700" },
  PAUSADA: { label: "Pausada", className: "bg-gray-100 text-gray-500" },
  CANCELADA: { label: "Cancelada", className: "bg-red-100 text-red-600" },
};
const CHANNEL_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  WHATSAPP: { label: "WhatsApp", Icon: MessageCircle, color: "#25D366" },
  WHATSAPP_PERSONAL: { label: "Evolution", Icon: MessageCircle, color: "#25D366" },
  FACEBOOK: { label: "Facebook", Icon: MessageSquare, color: "#1877F2" },
  INSTAGRAM: { label: "Instagram", Icon: Camera, color: "#E1306C" },
  SMS: { label: "SMS", Icon: MessageSquare, color: "#f97316" },
  EMAIL: { label: "Email", Icon: Mail, color: "#6b7280" },
};

export function CampanasClient({ workspaceId, campaigns, leadCount }: { workspaceId: string; campaigns: Campaign[]; leadCount: number }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  async function handlePause(id: string) { await setCampaignStatus(id, "PAUSADA"); router.refresh(); }
  async function handleResume(id: string) { await setCampaignStatus(id, "PROGRAMADA"); router.refresh(); }
  async function handleCancel(id: string) {
    if (!confirm("¿Cancelar esta campaña?")) return;
    await setCampaignStatus(id, "CANCELADA");
    router.refresh();
  }
  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta campaña? Esta acción no se puede deshacer.")) return;
    await deleteCampaign(id);
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Campañas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Mensajería masiva a tus leads — {leadCount} en tu base actual.</p>
          </div>
          <button onClick={() => { setEditing(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors">
            <Plus className="h-4 w-4" /> Nueva campaña
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center text-center gap-2">
            <Megaphone className="h-10 w-10 text-gray-300" />
            <p className="text-[14px] font-semibold text-gray-700">Aún no tienes campañas</p>
            <p className="text-[12.5px] text-muted-foreground max-w-sm">
              Crea una campaña para enviar un mensaje masivo a tus leads. El envío automático programado
              se activa cuando conectes los background jobs.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {campaigns.map((c) => {
              const statusMeta = STATUS_META[c.status] ?? STATUS_META.BORRADOR;
              const channelMeta = CHANNEL_META[c.channel] ?? CHANNEL_META.WHATSAPP;
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${channelMeta.color}1A` }}>
                    <channelMeta.Icon className="h-[18px] w-[18px]" style={{ color: channelMeta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-semibold text-gray-900 truncate">{c.name}</p>
                      <span className={cn("text-[10.5px] font-medium rounded-full px-2 py-0.5 shrink-0", statusMeta.className)}>{statusMeta.label}</span>
                      <span className="text-[10.5px] font-medium text-gray-400 shrink-0">{TYPE_LABEL[c.type] ?? c.type}</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate mt-0.5">{c.content}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.totalSent} enviados</span>
                      <span>{c.delivered} entregados</span>
                      <span>{c.opened} abiertos</span>
                      <span>{c.replied} respondidos</span>
                      {c.scheduledAt && <span>Programada: {new Date(c.scheduledAt).toLocaleString("es-DO")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.status === "PROGRAMADA" && (
                      <button onClick={() => handlePause(c.id)} title="Pausar" className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"><Pause className="h-4 w-4" /></button>
                    )}
                    {c.status === "PAUSADA" && (
                      <button onClick={() => handleResume(c.id)} title="Reanudar" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"><Play className="h-4 w-4" /></button>
                    )}
                    {(c.status === "BORRADOR" || c.status === "PROGRAMADA" || c.status === "PAUSADA") && (
                      <>
                        <button onClick={() => { setEditing(c); setModalOpen(true); }}
                          className="text-[12px] font-medium text-primary hover:bg-primary/5 rounded-md px-2 py-1.5 transition-colors">Editar</button>
                        <button onClick={() => handleCancel(c.id)} title="Cancelar" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Ban className="h-4 w-4" /></button>
                      </>
                    )}
                    <button onClick={() => handleDelete(c.id)} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <CampaignModal
            workspaceId={workspaceId}
            editing={editing}
            onClose={() => setModalOpen(false)}
            onSaved={() => { setModalOpen(false); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CampaignModal({ workspaceId, editing, onClose, onSaved }: {
  workspaceId: string; editing: Campaign | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<CampaignType>((editing?.type as CampaignType) ?? "BROADCAST");
  const [channel, setChannel] = useState<CampaignChannel>((editing?.channel as CampaignChannel) ?? "WHATSAPP_PERSONAL");
  const [subject, setSubject] = useState(editing?.subject ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [scheduledAt, setScheduledAt] = useState(editing?.scheduledAt ? editing.scheduledAt.slice(0, 16) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    if (!content.trim()) { setError("El contenido del mensaje es obligatorio."); return; }
    setSaving(true);
    setError("");
    const payload = {
      name: name.trim(), type, channel,
      subject: channel === "EMAIL" ? subject.trim() || null : null,
      content: content.trim(),
      scheduledAt: scheduledAt || null,
    };
    try {
      if (editing) await updateCampaign(editing.id, payload);
      else await createCampaign(workspaceId, payload);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la campaña.");
      setSaving(false);
    }
  }

  return (
    <ModalShell icon={Megaphone} iconColor="text-primary" iconBg="bg-primary/10"
      title={editing ? "Editar campaña" : "Nueva campaña"} subtitle="Mensaje masivo a tus leads" onClose={onClose}
      width={560}
      footer={<>
        <div />
        <div className="flex gap-2">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </>}>
      <div className="p-5 space-y-4">
        <div>
          <FieldLabel required>Nombre</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Promo fin de mes"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Tipo</FieldLabel>
            <select value={type} onChange={(e) => setType(e.target.value as CampaignType)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary bg-white">
              <option value="BROADCAST">Difusión (una sola vez)</option>
              <option value="SEQUENCE">Secuencia</option>
              <option value="TRIGGER">Disparador</option>
            </select>
          </div>
          <div>
            <FieldLabel>Canal</FieldLabel>
            <select value={channel} onChange={(e) => setChannel(e.target.value as CampaignChannel)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary bg-white">
              <option value="WHATSAPP_PERSONAL">Evolution</option>
              <option value="SMS">SMS</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>
        </div>
        {channel === "EMAIL" && (
          <div>
            <FieldLabel>Asunto</FieldLabel>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto del correo"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </div>
        )}
        <div>
          <FieldLabel required>Mensaje</FieldLabel>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Escribe el mensaje que recibirán tus leads…"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary resize-none" />
        </div>
        <div>
          <FieldLabel>Programar para (opcional)</FieldLabel>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          <p className="text-[11px] text-muted-foreground mt-1">Si no programas una fecha, la campaña queda como borrador.</p>
        </div>
        {error && <p className="text-[11.5px] text-red-500">{error}</p>}
      </div>
    </ModalShell>
  );
}
