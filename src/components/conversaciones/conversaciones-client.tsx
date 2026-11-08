"use client";

import { EditableName } from "@/components/leads/editable-name";
import {
  DeletedBubble, LocationBubble, MessageMenu, PollBubble, PollModal, PropertyLocationModal, ReactionBadges,
  type RichMsg,
} from "@/components/conversaciones/whatsapp-rich-ui";
import { editMessageText } from "@/app/actions/whatsapp-rich";
import { useState, useMemo, useRef, useEffect, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Send, Bot, MessageCircle, MessageSquare,
  Phone, Mail, Camera, Lock, Star, CheckCheck, Check, AlertCircle,
  Paperclip, Smile, User, Trash2, Tag,
  ChevronDown, ChevronUp, ArrowUpDown, SlidersHorizontal,
  ExternalLink, CheckSquare, Square, Calendar,
  X, Car, Plus,
  Minimize2, Zap, FileText, Clock, Folder,
  Mic, AlertTriangle,
  MapPin, BarChart3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { updateDealStage, updateDealStatus, createDeal, closeDeal } from "@/app/actions/deals";
import { ModalShell } from "@/components/agentes/action-modals";
import { registerPayment, deletePayment } from "@/app/actions/payments";
import { addNote, createTask, toggleTask, deleteTask, createAppointment, updateAppointmentStatus } from "@/app/actions/leads";
import { markConversationRead, sendMessage, sendVoiceNote, setConversationAiHandled, type Channel } from "@/app/actions/conversaciones";
import { uploadVoiceNote } from "@/app/actions/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ActivityTimeline, ACT_META } from "@/components/shared/activity-timeline";
import { useUnreadConversationsBadge } from "@/components/layout/unread-badge-context";

// ── Types ──────────────────────────────────────────────
// Exportados: la página de detalle de Lead (lead-detail-client.tsx) reutiliza estos
// mismos tipos y varios de los componentes de abajo (ChatHeader, DealsStrip,
// ActivitiesTab, TareasTab, NotasTab, CitasTab, PagosTab, DocumentosTab, etc.) para que
// el chat y los tabs se vean y funcionen exactamente igual que en Conversaciones.
export type Message = {
  id: string; conversationId: string; senderId: string | null;
  direction: string; channel: string; content: string;
  mediaUrl: string | null; mediaType: string | null;
  isRead: boolean; status: string; sentAt: string;
  meta?: unknown; reactions?: Record<string, string> | null; editedAt?: string | null; deletedAt?: string | null;
};
export type Stage = { id: string; name: string; color: string; order: number };
export type PropertyOption = { id: string; title: string; priceDOP: number | null; hasLocation?: boolean };
export type DealStage = { id: string; name: string; color: string };
export type DealProperty = { title: string };
export type Payment = {
  id: string; amount: number; currency: string; method: string;
  note: string | null; paidAt: string;
};
export type Deal = {
  id: string; status: string; value: number | null; currency: string;
  stage: DealStage | null; property: DealProperty | null;
  payments: Payment[];
};
export type Activity = {
  id: string; type: string; description: string;
  userId: string | null; createdAt: string; metadata: unknown;
};
export type Task = {
  id: string; title: string; description: string | null;
  status: string; priority: string;
  dueAt: string | null; completedAt: string | null; createdAt: string;
};
export type Appointment = {
  id: string; title: string; notes: string | null;
  type: string; status: string;
  startAt: string; endAt: string;
  location: string | null; createdAt: string;
};
export type Lead = {
  id: string; workspaceId: string;
  firstName: string; lastName: string | null;
  phone: string; stage: string | null; score: number; source: string;
  activities: Activity[];
  deals: Deal[];
  tasks: Task[];
  appointments: Appointment[];
};
export type Conversation = {
  id: string; channel: string; status: string;
  lastMessageAt: string | null; isAiHandled: boolean;
  lead: Lead | null; messages: Message[];
};

// ── Channel metadata ────────────────────────────────────
export const CH: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  WHATSAPP:          { label: "WhatsApp",  Icon: MessageCircle, color: "#25D366" },
  WHATSAPP_PERSONAL: { label: "Evolution", Icon: MessageCircle, color: "#25D366" },
  FACEBOOK:          { label: "Facebook",  Icon: MessageSquare, color: "#1877F2" },
  INSTAGRAM:         { label: "Instagram", Icon: Camera,        color: "#E1306C" },
  SMS:               { label: "SMS",       Icon: MessageSquare, color: "#f97316" },
  EMAIL:             { label: "Email",     Icon: Mail,          color: "#6b7280" },
  LLAMADA:           { label: "Llamada",   Icon: Phone,         color: "#8b5cf6" },
  INTERNO:           { label: "Interno",   Icon: Lock,          color: "#6b7280" },
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierto", PENDING: "Pendiente", RESOLVED: "Resuelto", SPAM: "Spam",
};
const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-gray-100 text-gray-500",
  SPAM: "bg-red-100 text-red-600",
};

// ── Helpers ─────────────────────────────────────────────
function convTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (d.toDateString() === yest.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit" });
}

export function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// Palomitas estilo WhatsApp: 1 palomita gris = enviado, 2 grises = entregado, 2 azules = leído.
export function MessageStatusTick({ status }: { status: string }) {
  if (status === "FAILED") return <AlertCircle className="h-3 w-3 text-red-400" />;
  if (status === "READ") return <CheckCheck className="h-3 w-3 text-primary" />;
  if (status === "DELIVERED") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  return <Check className="h-3 w-3 text-muted-foreground" />;
}

type TimelineItem =
  | { kind: "message"; data: Message; timestamp: string }
  | { kind: "activity"; data: Activity; timestamp: string };

export function buildTimeline(messages: Message[], activities: Activity[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((m) => ({ kind: "message" as const, data: m, timestamp: m.sentAt })),
    // MESSAGE_SENT es redundante acá — el bubble del mensaje ya muestra que se envió,
    // con su propia palomita de estado. Sigue existiendo como Activity para el tab de
    // Actividades, solo no se duplica dentro del chat.
    ...activities.filter((a) => a.type !== "MESSAGE_SENT").map((a) => ({ kind: "activity" as const, data: a, timestamp: a.createdAt })),
  ];
  return items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function groupTimeline(items: TimelineItem[]) {
  const groups: { label: string; items: TimelineItem[] }[] = [];
  for (const item of items) {
    const d = new Date(item.timestamp);
    const now = new Date();
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    const label = d.toDateString() === now.toDateString()
      ? "Hoy"
      : d.toDateString() === yest.toDateString()
        ? "Ayer"
        : d.toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

// ACT_META y ACT_TITLE importados de @/components/shared/activity-timeline

export function DealsStrip({ deals, stages }: { deals: Deal[]; stages: Stage[] }) {
  if (!deals.length) return null;
  return (
    <div className="bg-white border-b border-border divide-y divide-border overflow-y-auto" style={{ maxHeight: "108px" }}>
      {deals.map((deal, i) => (
        <DealTrack key={deal.id} deal={deal} stages={stages} index={i} />
      ))}
    </div>
  );
}

function DealTrack({ deal, stages, index }: { deal: Deal; stages: Stage[]; index: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const propertyLabel = deal.property
    ? `${deal.property.title}`
    : `Negocio #${index + 1}`;
  const currentIdx = stages.findIndex((s) => s.id === deal.stage?.id);
  const activeStage = stages[currentIdx];

  async function moveStage(stageId: string) {
    setPending(stageId);
    await updateDealStage(deal.id, stageId);
    router.refresh();
    setPending(null);
  }

  async function setStatus(status: "WON" | "LOST") {
    const next = deal.status === status ? "OPEN" : status;
    setPending(next);
    try {
      if (next === "WON") {
        // Ganar un negocio pasa por la Orden de Venta (debida diligencia, autorización, comisión).
        const result = await closeDeal(deal.id, "WON");
        if (result.salesOrderId) { router.push(`/ordenes-venta/${result.salesOrderId}`); return; }
      } else {
        await updateDealStatus(deal.id, next as "OPEN" | "LOST");
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      {/* Property label */}
      <span className="text-[11px] text-muted-foreground truncate shrink-0 max-w-[90px]" title={propertyLabel}>
        <Car className="inline h-3 w-3 mr-0.5 -mt-px" />
        {propertyLabel}
      </span>

      {/* Track: all dots (stages + outcomes) equidistant */}
      {(() => {
        const totalCols = stages.length + 2; // +2 for WON/LOST
        const progressPct = currentIdx >= 0
          ? (currentIdx / (totalCols - 1)) * 100
          : 0;
        return (
          <div className="flex-1 relative flex items-center min-w-0">
            {/* Background line */}
            <div className="absolute inset-x-0 h-px bg-gray-200 pointer-events-none" />
            {/* Progress line */}
            {currentIdx > 0 && (
              <div className="absolute left-0 h-px bg-green-500 pointer-events-none transition-all duration-300"
                style={{ width: `${progressPct}%` }} />
            )}

            {/* Stage columns */}
            {stages.map((stage, i) => {
              const isActive = i === currentIdx;
              const isPast = i < currentIdx;
              return (
                <div key={stage.id} className="flex-1 flex justify-center relative z-10">
                  {isActive ? (
                    <motion.div
                      layoutId={`pill-${deal.id}`}
                      className="flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-semibold text-white select-none whitespace-nowrap"
                      style={{ backgroundColor: activeStage?.color ?? "#22c55e" }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    >
                      {activeStage?.name ?? "—"}
                      <ChevronDown className="h-2.5 w-2.5 opacity-70 shrink-0" />
                    </motion.div>
                  ) : (
                    <button title={stage.name} disabled={!!pending} onClick={() => moveStage(stage.id)}
                      className={cn(
                        "h-2.5 w-2.5 rounded-full border-2 transition-all duration-200",
                        "hover:scale-150 focus:outline-none disabled:cursor-not-allowed",
                        pending === stage.id ? "border-green-400 bg-green-200 scale-125"
                          : isPast ? "bg-green-500 border-green-500"
                          : "bg-white border-gray-300 hover:border-gray-400"
                      )}
                    />
                  )}
                </div>
              );
            })}

            {/* Ganado dot */}
            <div className="flex-1 flex justify-center relative z-10">
              <button title="Ganado" disabled={!!pending} onClick={() => setStatus("WON")}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border-2 transition-all hover:scale-150 focus:outline-none",
                  deal.status === "WON" ? "bg-green-500 border-green-500" : "bg-white border-green-400 hover:bg-green-100"
                )}
              />
            </div>

            {/* Perdido dot */}
            <div className="flex-1 flex justify-center relative z-10">
              <button title="Perdido" disabled={!!pending} onClick={() => setStatus("LOST")}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border-2 transition-all hover:scale-150 focus:outline-none",
                  deal.status === "LOST" ? "bg-red-500 border-red-500" : "bg-white border-red-400 hover:bg-red-100"
                )}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export function ActivityEvent({ activity }: { activity: Activity }) {
  const meta = ACT_META[activity.type] ?? ACT_META.LEAD_UPDATED;
  const { Icon } = meta;

  if (activity.type === "NOTE_ADDED") {
    return (
      <div className="flex justify-end mb-1">
        <div className="max-w-[70%]">
          <div className="flex items-center gap-1 mb-1 justify-end">
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
              Nota interna
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl rounded-tr-sm bg-amber-50 border border-amber-200 text-[13px] leading-relaxed text-amber-900">
            {activity.description}
          </div>
          <div className="flex items-center gap-1 mt-0.5 px-1 justify-end">
            <span className="text-[10px] text-muted-foreground">{msgTime(activity.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center my-2.5">
      <div className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1 border border-border/50 max-w-[90%]",
        meta.bg
      )}>
        <span className={cn("shrink-0", meta.color)}>
          <Icon className="h-3 w-3" />
        </span>
        <span className="text-[11px] text-foreground/70 truncate">{activity.description}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">· {msgTime(activity.createdAt)}</span>
      </div>
    </div>
  );
}

type TabKey = "unread" | "all" | "recents" | "starred";

// Sentinel para agrupar conversaciones cuyo lead no tiene etapa asignada (o no tiene lead).
const NO_STAGE = "__sin_etapa__";

// ══════════════════════════════════════════════════════
export function ConversacionesClient({ conversations, stages, pipelineId, properties }: {
  conversations: Conversation[]; stages: Stage[]; pipelineId: string | null; properties: PropertyOption[];
}) {
  const router = useRouter();
  const [locationOpen, setLocationOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [richError, setRichError] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const { decrement: decrementUnreadBadge } = useUnreadConversationsBadge();
  // Sin auto-selección: al entrar a Conversaciones se ve la lista vacía de chat
  // hasta que la persona elige con cuál conversación quiere entrar.
  const [selected, setSelected]       = useState<Conversation | null>(null);
  const [aiToggleBusy, setAiToggleBusy]   = useState(false);
  // Guarda IDs de MENSAJES (no de conversaciones) ya marcados como leídos en esta sesión,
  // para no esperar el round-trip al servidor. Debe ser a nivel de mensaje: si fuera a nivel
  // de conversación, un mensaje nuevo que llegue después seguiría oculto para siempre porque
  // el id de la conversación ya estaría en el set.
  const [readIds, setReadIds]         = useState<Set<string>>(() => {
    // Marca como leídos los mensajes de la conversación inicial al montar
    const first = conversations[0];
    if (!first) return new Set();
    return new Set(first.messages.filter(m => !m.isRead && m.direction === "INBOUND").map(m => m.id));
  });
  const [tab, setTab]                 = useState<TabKey>("all");
  const [channelFilter, setChannelFilter] = useState<Set<string>>(new Set());
  const [stageFilter, setStageFilter] = useState<Set<string>>(new Set());
  const [search, setSearch]           = useState("");
  const [starred, setStarred]         = useState<Set<string>>(new Set());
  const [checked, setChecked]         = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll]     = useState(false);
  const [input, setInput]             = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  // Marca la conversación como leída al montarse (si hay una abierta por defecto)
  useEffect(() => {
    const first = conversations[0];
    if (first) {
      const hasUnread = first.messages.some(m => !m.isRead && m.direction === "INBOUND");
      if (hasUnread) {
        decrementUnreadBadge();
        markConversationRead(first.id).then(() => router.refresh());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resincroniza la conversación abierta cuando llegan datos frescos del servidor
  // (p.ej. tras router.refresh() por un mensaje nuevo o una respuesta del bot).
  useEffect(() => {
    if (!selected) return;
    const fresh = conversations.find((c) => c.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  // La suscripción de tiempo real (postgres_changes sobre messages/conversations,
  // con reconexión y re-auth automáticos) ahora vive una sola vez en el layout del
  // dashboard (UnreadBadgeProvider) — router.refresh() desde ahí ya recalcula toda
  // la ruta actual, incluida esta página cuando está activa. Ver use-realtime-refresh.ts.

  function selectConversation(conv: Conversation) {
    setSelected(conv);
    const unreadMsgIds = conv.messages.filter(m => !m.isRead && m.direction === "INBOUND" && !readIds.has(m.id)).map(m => m.id);
    if (unreadMsgIds.length > 0) {
      // Optimista: quita el punto/negrita de la fila y el badge del sidebar de inmediato,
      // sin esperar el round-trip al servidor.
      setReadIds(prev => new Set([...prev, ...unreadMsgIds]));
      decrementUnreadBadge();
      markConversationRead(conv.id).then(() => router.refresh());
    }
  }
  const [composerMode, setComposerMode] = useState<"message" | "note">("message");
  const [composerFocused, setComposerFocused] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [outChannel, setOutChannel]   = useState<string>(
    () => conversations[0]?.messages.at(-1)?.channel ?? conversations[0]?.channel ?? "WHATSAPP"
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Se ejecuta justo cuando el textarea del composer se monta en el DOM (al pasar de
  // compacto a expandido), así el click que lo abre también deja el cursor listo para
  // escribir — antes hacía falta un segundo click porque el textarea real no existe
  // hasta que se abre el modo expandido.
  const focusComposerOnMount = useCallback((el: HTMLTextAreaElement | null) => {
    el?.focus();
  }, []);

  // ── Nota de voz ──────────────────────────────────────
  const [isRecording, setIsRecording]     = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob]   = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl]     = useState<string | null>(null);
  const [sendingVoice, setSendingVoice]   = useState(false);
  const [voiceError, setVoiceError]       = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardNextRef   = useRef(false);

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  function releaseStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setVoiceError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      discardNextRef.current = false;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        releaseStream();
        if (discardNextRef.current) { discardNextRef.current = false; return; }
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setVoiceError("No se pudo acceder al micrófono. Verifica los permisos del navegador.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    stopTimer();
  }

  function cancelRecording() {
    discardNextRef.current = true;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    stopTimer();
    releaseStream();
  }

  function discardRecordedNote() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordSeconds(0);
  }

  async function sendRecordedNote() {
    if (!recordedBlob || !selected) return;
    setSendingVoice(true);
    setVoiceError("");
    const fd = new FormData();
    const ext = recordedBlob.type.includes("webm") ? "webm" : "m4a";
    fd.append("file", recordedBlob, `nota-voz.${ext}`);
    const result = await uploadVoiceNote(fd);
    if (!result.url) {
      setVoiceError(result.error ?? "Error desconocido.");
      setSendingVoice(false);
      return;
    }
    await sendVoiceNote(selected.id, outChannel as Channel, result.url);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordSeconds(0);
    setSendingVoice(false);
    router.refresh();
  }

  async function handleToggleAiHandled() {
    if (!selected) return;
    setAiToggleBusy(true);
    await setConversationAiHandled(selected.id, !selected.isAiHandled);
    router.refresh();
    setAiToggleBusy(false);
  }

  async function handleSendComposer() {
    if (!selected || !input.trim() || sendingMessage) return;
    setSendingMessage(true);
    try {
      if (composerMode === "note") {
        if (selected.lead) await addNote(selected.lead.workspaceId, selected.lead.id, input.trim());
      } else {
        await sendMessage(selected.id, outChannel as Channel, input.trim());
      }
      setInput("");
      setComposerFocused(false);
      router.refresh();
    } finally {
      setSendingMessage(false);
    }
  }

  function formatSeconds(total: number) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // Mantener siempre visible el final de la conversación: baja al último mensaje
  // cada vez que cambia la cantidad de mensajes (uno nuevo entrante o enviado) y al
  // abrir una conversación. Instantáneo al cambiar de conversación (para arrancar abajo),
  // suave cuando llega un mensaje nuevo estando ya adentro.
  const prevConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    const switchedConversation = prevConvIdRef.current !== (selected?.id ?? null);
    prevConvIdRef.current = selected?.id ?? null;
    bottomRef.current?.scrollIntoView({ behavior: switchedConversation ? "auto" : "smooth" });
  }, [selected?.id, selected?.messages.length]);

  // Al expandir el composer (o crecer al enfocarlo) ocupa más alto y encoge el área de
  // mensajes, tapando el último. La animación es un spring de Framer Motion (duración
  // variable, no fija), así que un setTimeout con un valor adivinado deja un margen sin
  // cubrir — en su lugar, un ResizeObserver detecta cada frame en que el contenedor
  // cambia de tamaño y lo vuelve a pegar al fondo mientras dura la animación real.
  const stickToBottomRef = useRef(false);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) container.scrollTop = container.scrollHeight;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!composerOpen) return;
    stickToBottomRef.current = true;
    messagesContainerRef.current?.scrollTo({ top: messagesContainerRef.current.scrollHeight });
    // La animación del composer dura bien por debajo de 1s; después de eso ya no hace
    // falta seguir pegado al fondo (para no pelear con un scroll manual del usuario).
    const t = setTimeout(() => { stickToBottomRef.current = false; }, 1000);
    return () => { stickToBottomRef.current = false; clearTimeout(t); };
  }, [composerOpen, composerFocused]);

  // Sync outChannel to last used channel when switching conversation
  useEffect(() => {
    if (!selected) return;
    const last = selected.messages.at(-1)?.channel ?? selected.channel;
    setOutChannel(last);
  }, [selected?.id]);

  // Descarta cualquier grabación de voz en curso al cambiar de conversación
  useEffect(() => {
    cancelRecording();
    discardRecordedNote();
    setVoiceError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Libera el micrófono si el componente se desmonta a mitad de una grabación
  useEffect(() => {
    return () => { releaseStream(); stopTimer(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const channels = useMemo(() => Array.from(new Set(conversations.map((c) => c.channel))), [conversations]);

  // Una conversación tiene no-leídos si tiene algún mensaje INBOUND sin leer que no hayamos
  // marcado ya en esta sesión (a nivel de MENSAJE: así un mensaje nuevo que llegue después
  // de marcar la conversación como leída sigue mostrándose como no-leído).
  const isUnread = (c: Conversation) =>
    c.messages.some((m) => !m.isRead && m.direction === "INBOUND" && !readIds.has(m.id));

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      const hasUnread = isUnread(c);
      if (tab === "unread"  && !hasUnread)          return false;
      if (tab === "starred" && !starred.has(c.id))  return false;
      if (channelFilter.size > 0 && !channelFilter.has(c.channel)) return false;
      if (stageFilter.size > 0) {
        // El movimiento real de etapa vive en Deal.stageId, no en Lead.stage (que se fija
        // una sola vez al crear el lead y nunca se actualiza — ver deals.ts:updateDealStage).
        // Un lead "está" en una etapa si tiene un negocio abierto en ella.
        const openStageIds = (c.lead?.deals ?? [])
          .filter((d) => d.status === "OPEN" && d.stage)
          .map((d) => d.stage!.id);
        const matches = openStageIds.length > 0
          ? openStageIds.some((id) => stageFilter.has(id))
          : stageFilter.has(NO_STAGE);
        if (!matches) return false;
      }
      if (search) {
        const name = `${c.lead?.firstName ?? ""} ${c.lead?.lastName ?? ""}`.toLowerCase();
        if (!name.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, tab, starred, channelFilter, stageFilter, search, readIds]);

  const unreadCount = useMemo(() =>
    conversations.filter((c) => c.messages.some((m) => !m.isRead && m.direction === "INBOUND")).length,
    [conversations]
  );

  function toggleStar(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setStarred((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function toggleCheck(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setChecked((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function handleSelectAll() {
    if (selectAll) { setChecked(new Set()); setSelectAll(false); }
    else { setChecked(new Set(filtered.map((c) => c.id))); setSelectAll(true); }
  }

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: "all",    label: "Todos" },
    { key: "unread", label: "Sin leer", count: unreadCount || undefined },
  ];

  return (
    <div className="flex flex-1 overflow-hidden h-full">

      {/* ── Panel 1: Lista ───────────────────────── */}
      <div className="w-[300px] shrink-0 border-r border-border bg-white flex flex-col">

        {/* Search + sort */}
        <div className="px-3 pt-3 pb-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..." className="h-8 pl-8 text-xs pr-3" />
            </div>
            <div className="flex gap-1 ml-2">
              <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
              <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Tabs + channel pills in same row */}
          <div className="flex items-center border-b border-border -mx-3 px-3">
            {/* Tabs */}
            <div className="flex text-[11px] font-medium shrink-0">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-1 pb-2 mr-4 transition-colors border-b-2 -mb-px",
                    tab === t.key
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}>
                  {t.label}
                  {t.count ? (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                      {t.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {/* Stage dropdown — multi-select */}
            <div className="pb-2 ml-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium border transition-colors",
                    stageFilter.size > 0
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  )}>
                    {stageFilter.size === 1 && stageFilter.has(NO_STAGE) === false && (
                      <span className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: stages.find((s) => s.id === Array.from(stageFilter)[0])?.color }} />
                    )}
                    {stageFilter.size === 0
                      ? "Etapa"
                      : stageFilter.size === 1
                        ? (Array.from(stageFilter)[0] === NO_STAGE
                            ? "Sin etapa"
                            : (stages.find((s) => s.id === Array.from(stageFilter)[0])?.name ?? "Etapa"))
                        : `${stageFilter.size} etapas`}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {/* Todas option */}
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); setStageFilter(new Set()); }}
                    className={cn("text-xs gap-2", stageFilter.size === 0 && "font-semibold text-primary")}
                  >
                    <span className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0",
                      stageFilter.size === 0 ? "bg-primary border-primary" : "border-border"
                    )}>
                      {stageFilter.size === 0 && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                    </span>
                    Todas las etapas
                  </DropdownMenuItem>

                  {stages.map((stage) => {
                    const active = stageFilter.has(stage.id);
                    return (
                      <DropdownMenuItem key={stage.id}
                        onSelect={(e) => {
                          e.preventDefault();
                          setStageFilter((prev) => {
                            const s = new Set(prev);
                            if (s.has(stage.id)) s.delete(stage.id); else s.add(stage.id);
                            return s;
                          });
                        }}
                        className="text-xs gap-2"
                      >
                        <span className={cn(
                          "flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0",
                          active ? "bg-primary border-primary" : "border-border"
                        )}>
                          {active && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                        </span>
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </DropdownMenuItem>
                    );
                  })}

                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setStageFilter((prev) => {
                        const s = new Set(prev);
                        if (s.has(NO_STAGE)) s.delete(NO_STAGE); else s.add(NO_STAGE);
                        return s;
                      });
                    }}
                    className="text-xs gap-2"
                  >
                    <span className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0",
                      stageFilter.has(NO_STAGE) ? "bg-primary border-primary" : "border-border"
                    )}>
                      {stageFilter.has(NO_STAGE) && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                    </span>
                    <span className="h-2 w-2 rounded-full shrink-0 bg-gray-300" />
                    Sin etapa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Channel dropdown — multi-select */}
            <div className="ml-auto pb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium border transition-colors",
                    channelFilter.size > 0
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  )}>
                    {channelFilter.size === 1 && (
                      <span className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: CH[Array.from(channelFilter)[0]]?.color }} />
                    )}
                    {channelFilter.size === 0
                      ? "Canal"
                      : channelFilter.size === 1
                        ? (CH[Array.from(channelFilter)[0]]?.label ?? Array.from(channelFilter)[0])
                        : `${channelFilter.size} canales`}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {/* Todos option */}
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); setChannelFilter(new Set()); }}
                    className={cn("text-xs gap-2", channelFilter.size === 0 && "font-semibold text-primary")}
                  >
                    <span className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0",
                      channelFilter.size === 0 ? "bg-primary border-primary" : "border-border"
                    )}>
                      {channelFilter.size === 0 && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                    </span>
                    Todos los canales
                  </DropdownMenuItem>

                  {channels.map((ch) => {
                    const meta = CH[ch];
                    const active = channelFilter.has(ch);
                    return (
                      <DropdownMenuItem key={ch}
                        onSelect={(e) => {
                          e.preventDefault();
                          setChannelFilter((prev) => {
                            const s = new Set(prev);
                            if (s.has(ch)) s.delete(ch); else s.add(ch);
                            return s;
                          });
                        }}
                        className="text-xs gap-2"
                      >
                        <span className={cn(
                          "flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0",
                          active ? "bg-primary border-primary" : "border-border"
                        )}>
                          {active && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                        </span>
                        {meta && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />}
                        {meta?.label ?? ch}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Select all */}
        <div className="flex items-center px-3 py-1.5 border-b border-border/60">
          <button onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            {selectAll
              ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
              : <Square className="h-3.5 w-3.5" />}
            Seleccionar todo
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">Sin conversaciones</p>
          ) : (
            <AnimatePresence>
              {filtered.map((conv, i) => {
                const meta = CH[conv.channel] ?? CH.INTERNO;
                const ChIcon = meta.Icon;
                const last = conv.messages[conv.messages.length - 1];
                const hasUnread = isUnread(conv);
                const isStarred = starred.has(conv.id);
                const isChecked = checked.has(conv.id);
                const isSelected = selected?.id === conv.id;
                const name = conv.lead
                  ? `${conv.lead.firstName} ${conv.lead.lastName ?? ""}`.trim()
                  : "Sin contacto";
                const initials = conv.lead
                  ? `${conv.lead.firstName[0]}${conv.lead.lastName?.[0] ?? ""}`.toUpperCase()
                  : "?";

                return (
                  <motion.div key={conv.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => selectConversation(conv)}
                    className={cn(
                      "group flex items-start gap-2 px-3 py-2.5 border-b border-border/40 cursor-pointer transition-colors",
                      isSelected
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : hasUnread
                          ? "bg-blue-50/80 hover:bg-blue-50"
                          : "hover:bg-muted/40",
                    )}>

                    {/* Checkbox */}
                    <button onClick={(e) => toggleCheck(conv.id, e)}
                      className={cn(
                        "mt-1 shrink-0 transition-opacity",
                        isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}>
                      {isChecked
                        ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                        : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>

                    {/* Avatar + channel dot */}
                    <div className="relative shrink-0">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white"
                        style={{ backgroundColor: meta.color }}>
                        <ChIcon className="h-2 w-2 text-white" />
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-0.5">
                        <span className={cn("text-[12px] truncate", hasUnread ? "font-bold text-foreground" : "font-medium text-foreground/80")}>
                          {name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="text-[10px] text-muted-foreground">{convTime(conv.lastMessageAt)}</span>
                          {hasUnread && (
                            <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn("text-[11px] truncate", hasUnread ? "text-foreground font-bold" : "text-muted-foreground")}>
                          {last?.direction === "OUTBOUND" && <span className="text-muted-foreground/70">Tú: </span>}
                          {last?.content ?? "—"}
                        </p>
                        <button onClick={(e) => toggleStar(conv.id, e)}
                          className={cn(
                            "shrink-0 transition-all",
                            isStarred ? "opacity-100 text-amber-400" : "opacity-0 group-hover:opacity-60 text-muted-foreground hover:text-amber-400"
                          )}>
                          <Star className={cn("h-3.5 w-3.5", isStarred && "fill-amber-400")} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Bulk actions bar */}
        <AnimatePresence>
          {checked.size > 0 && (
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="border-t border-border bg-primary/5 px-3 py-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-primary">{checked.size} seleccionadas</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-6 text-[10px]">Archivar</Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px] text-destructive border-destructive/30">Eliminar</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Panel 2: Chat ────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F5F5]">
        {selected ? (
          <>
            <ChatHeader conversation={selected} starred={starred.has(selected.id)}
              pipelineId={pipelineId} stages={stages} properties={properties}
              onStar={() => {
                setStarred((prev) => {
                  const s = new Set(prev);
                  if (s.has(selected.id)) s.delete(selected.id); else s.add(selected.id);
                  return s;
                });
              }} />
            <DealsStrip deals={selected.lead?.deals ?? []} stages={stages} />

            {/* Timeline: messages + activity log */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
              {groupTimeline(buildTimeline(selected.messages, selected.lead?.activities ?? [])).map((group) => (
                <div key={group.label}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium px-2">
                      <Calendar className="h-3 w-3" />{group.label}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {(() => {
                    let shownNew = false;
                    return group.items.map((item, i) => {
                      if (item.kind === "activity") {
                        return <ActivityEvent key={item.data.id} activity={item.data} />;
                      }
                      const msg = item.data;
                      const isOut = msg.direction === "OUTBOUND";
                      const isWa = selected.channel === "WHATSAPP" || selected.channel === "WHATSAPP_PERSONAL";
                      const isFirstUnread = !msg.isRead && msg.direction === "INBOUND" && !shownNew;
                      if (isFirstUnread) shownNew = true;
                      const prevItem = group.items[i - 1];
                      const prevMsg = prevItem?.kind === "message" ? prevItem.data : null;
                      const showSenderName = !isOut && (!prevMsg || prevMsg.direction !== "INBOUND");

                      return (
                        <div key={msg.id}>
                          {isFirstUnread && (
                            <div className="flex items-center gap-3 my-3">
                              <div className="flex-1 h-px bg-primary/30" />
                              <span className="text-[10px] font-semibold text-primary px-2">Nuevo</span>
                              <div className="flex-1 h-px bg-primary/30" />
                            </div>
                          )}
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            className={cn("flex gap-2 mb-1", isOut ? "justify-end" : "justify-start")}>
                            {!isOut && (
                              <div className="w-7 shrink-0 mt-5">
                                {showSenderName && (
                                  <Avatar className="h-7 w-7">
                                    <AvatarFallback className="text-[10px] bg-muted">
                                      {selected.lead?.firstName?.[0] ?? "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                              </div>
                            )}
                            <div className={cn("max-w-[70%] flex flex-col", isOut ? "items-end" : "items-start")}>
                              {showSenderName && !isOut && (
                                <span className="text-[10px] text-muted-foreground font-medium mb-1 ml-1">
                                  {selected.lead ? `${selected.lead.firstName} ${selected.lead.lastName ?? ""}`.trim() : "Contacto"}
                                </span>
                              )}
                              <div className="group relative max-w-full">
                              <MessageMenu msg={msg as RichMsg} isOut={isOut} waCapable={isWa}
                                onEdit={(m) => { setRichError(""); setEditing({ id: m.id, text: m.content }); }}
                                onError={setRichError} />
                              {msg.deletedAt ? (
                                <DeletedBubble isOut={isOut} />
                              ) : msg.mediaType === "location" ? (
                                <LocationBubble msg={msg as RichMsg} isOut={isOut} />
                              ) : msg.mediaType === "poll" ? (
                                <PollBubble msg={msg as RichMsg} isOut={isOut} />
                              ) : editing?.id === msg.id ? (
                                <div className="flex flex-col gap-1.5 w-[260px]">
                                  <textarea value={editing.text} onChange={(e) => setEditing({ id: msg.id, text: e.target.value })} autoFocus rows={3}
                                    className="w-full border border-primary rounded-xl px-3 py-2 text-[13px] outline-none resize-none" />
                                  <div className="flex justify-end gap-1.5">
                                    <button onClick={() => setEditing(null)} className="text-[11.5px] px-2.5 py-1 rounded-md hover:bg-muted">Cancelar</button>
                                    <button disabled={editBusy || !editing.text.trim()} onClick={async () => {
                                      setEditBusy(true);
                                      const r = await editMessageText(msg.id, editing.text);
                                      setEditBusy(false);
                                      if (!r.ok) { setRichError(r.error); return; }
                                      setEditing(null); router.refresh();
                                    }} className="text-[11.5px] px-2.5 py-1 rounded-md bg-primary text-white disabled:opacity-60">{editBusy ? "Guardando…" : "Guardar"}</button>
                                  </div>
                                </div>
                              ) : msg.mediaType === "audio" && msg.mediaUrl ? (
                                <div className={cn(
                                  "px-2.5 py-2 rounded-2xl flex items-center gap-2",
                                  isOut ? "bg-primary text-white rounded-tr-sm" : "bg-white border border-border/60 rounded-tl-sm shadow-sm"
                                )}>
                                  <Mic className={cn("h-3.5 w-3.5 shrink-0", isOut ? "text-white/80" : "text-muted-foreground")} />
                                  <audio controls src={msg.mediaUrl} className="h-8 max-w-[200px]" style={{ filter: isOut ? "invert(1) hue-rotate(180deg)" : undefined }} />
                                </div>
                              ) : msg.mediaType === "image" && msg.mediaUrl ? (
                                <div className="rounded-2xl overflow-hidden max-w-[220px]">
                                  <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="block">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={msg.mediaUrl} alt="Imagen" className="w-full h-auto block max-h-[280px] object-cover" />
                                  </a>
                                  {msg.content && msg.content !== "📷 Imagen" && (
                                    <div className={cn("px-3 py-1.5 text-[13px] leading-relaxed",
                                      isOut ? "bg-primary text-white" : "bg-white border-x border-b border-border/60")}>
                                      {msg.content}
                                    </div>
                                  )}
                                </div>
                              ) : msg.mediaType === "video" && msg.mediaUrl ? (
                                <div className="rounded-2xl overflow-hidden max-w-[220px]">
                                  <video controls src={msg.mediaUrl} className="w-full h-auto block max-h-[280px]" />
                                  {msg.content && msg.content !== "🎥 Video" && (
                                    <div className={cn("px-3 py-1.5 text-[13px] leading-relaxed",
                                      isOut ? "bg-primary text-white" : "bg-white border-x border-b border-border/60")}>
                                      {msg.content}
                                    </div>
                                  )}
                                </div>
                              ) : msg.mediaType === "document" && msg.mediaUrl ? (
                                <a href={msg.mediaUrl} target="_blank" rel="noreferrer"
                                  className={cn("px-3.5 py-2.5 rounded-2xl flex items-center gap-2 text-[13px] max-w-[220px]",
                                    isOut ? "bg-primary text-white rounded-tr-sm" : "bg-white border border-border/60 rounded-tl-sm shadow-sm")}>
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{msg.content}</span>
                                </a>
                              ) : (
                                <div className={cn(
                                  "px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed",
                                  isOut ? "bg-primary text-white rounded-tr-sm"
                                        : "bg-white border border-border/60 rounded-tl-sm shadow-sm"
                                )}>
                                  {msg.content}
                                </div>
                              )}
                              </div>
                              <ReactionBadges reactions={msg.reactions} isOut={isOut} />
                              <div className={cn("flex items-center gap-1 mt-0.5 px-1", isOut ? "justify-end" : "justify-start")}>
                                <span className="text-[10px] text-muted-foreground">{msgTime(msg.sentAt)}</span>
                                {msg.editedAt && !msg.deletedAt && <span className="text-[10px] text-muted-foreground">· editado</span>}
                                {isOut && <MessageStatusTick status={msg.status} />}
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {richError && (
              <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span className="flex-1">{richError}</span>
                <button onClick={() => setRichError("")} className="text-red-400 hover:text-red-600">✕</button>
              </div>
            )}
            {locationOpen && selected && <PropertyLocationModal conversationId={selected.id} properties={properties} onClose={() => setLocationOpen(false)} />}
            {pollOpen && selected && <PollModal conversationId={selected.id} onClose={() => setPollOpen(false)} />}

            {/* Composer */}
            <div className="bg-white border-t border-border">
              <AnimatePresence mode="wait">
                {composerOpen ? (
                  <motion.div
                    key="expanded"
                    initial={{ height: 44, opacity: 0.6 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 44, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    className="overflow-hidden border border-border rounded-lg mx-3 mb-3 mt-2"
                  >
                    {/* Tab bar */}
                    <div className="flex items-center border-b border-border bg-muted/10">
                      {/* Channel dropdown tab */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn(
                            "flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 -mb-px transition-all shrink-0",
                            composerMode === "message"
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          )} onClick={() => setComposerMode("message")}>
                            {(() => {
                              const meta = CH[outChannel];
                              const Icon = meta?.Icon ?? MessageCircle;
                              return (
                                <>
                                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
                                    style={{ backgroundColor: meta?.color ?? "#6b7280" }}>
                                    <Icon className="h-2 w-2 text-white" />
                                  </span>
                                  {meta?.label ?? outChannel}
                                  <ChevronDown className="h-3 w-3 opacity-50" />
                                </>
                              );
                            })()}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" className="w-44">
                          {(["WHATSAPP", "FACEBOOK", "INSTAGRAM"] as const).map((ch) => {
                            const meta = CH[ch];
                            const Icon = meta.Icon;
                            return (
                              <DropdownMenuItem key={ch} onClick={() => { setOutChannel(ch); setComposerMode("message"); }}
                                className={cn("gap-2 cursor-pointer", outChannel === ch && composerMode === "message" && "bg-accent")}>
                                <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: meta.color }}>
                                  <Icon className="h-3 w-3 text-white" />
                                </span>
                                {meta.label}
                                {outChannel === ch && composerMode === "message" && <CheckCheck className="h-3.5 w-3.5 ml-auto text-primary" />}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Separator */}
                      <div className="w-px h-4 bg-border mx-1 shrink-0" />

                      {/* Nota Interna tab */}
                      <button
                        onClick={() => setComposerMode("note")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 -mb-px transition-all shrink-0",
                          composerMode === "note"
                            ? "border-amber-500 text-amber-600"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Lock className="h-3 w-3" />
                        Nota Interna
                      </button>

                      {/* Minimize */}
                      <button
                        onClick={() => setComposerOpen(false)}
                        title="Minimizar"
                        className="ml-auto p-2 text-muted-foreground/40 hover:text-foreground transition-colors shrink-0"
                      >
                        <Minimize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Channel/mode label */}
                    <div className={cn(
                      "px-3 pt-2 pb-0.5 text-[11px] font-semibold",
                      composerMode === "note" ? "text-amber-600" : "text-muted-foreground"
                    )}>
                      {composerMode === "note" ? "Nota Interna" : (CH[outChannel]?.label ?? outChannel)}
                    </div>

                    {/* Textarea / Grabación / Vista previa */}
                    {isRecording ? (
                      <div className="flex items-center gap-2.5 px-3 py-3">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                        </span>
                        <span className="text-sm font-medium text-foreground flex-1">Grabando… {formatSeconds(recordSeconds)}</span>
                        <button onClick={cancelRecording} title="Cancelar"
                          className="p-1.5 text-muted-foreground hover:text-red-500 rounded-md hover:bg-muted transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button onClick={stopRecording} title="Detener"
                          className="p-1.5 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors">
                          <Square className="h-3.5 w-3.5 fill-current" />
                        </button>
                      </div>
                    ) : recordedBlob ? (
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <Mic className="h-4 w-4 text-primary shrink-0" />
                        <audio controls src={recordedUrl ?? undefined} className="h-8 flex-1" />
                        <button onClick={discardRecordedNote} title="Descartar" disabled={sendingVoice}
                          className="p-1.5 text-muted-foreground hover:text-red-500 rounded-md hover:bg-muted transition-colors disabled:opacity-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Button size="sm" onClick={sendRecordedNote} disabled={sendingVoice} className="h-8 px-3 text-sm">
                          <Send className="h-3.5 w-3.5 mr-1" />
                          {sendingVoice ? "Enviando…" : "Enviar"}
                        </Button>
                      </div>
                    ) : (
                      <textarea
                        ref={focusComposerOnMount}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={() => setComposerFocused(true)}
                        onBlur={() => { if (!input.trim()) setComposerFocused(false); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComposer(); }
                          if (e.key === "Escape") { setComposerOpen(false); setComposerFocused(false); }
                        }}
                        placeholder={composerMode === "note" ? "Escribe una nota interna…" : "Escribe un mensaje…"}
                        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 leading-relaxed px-3 py-1.5 transition-all duration-200"
                        style={{ height: composerFocused || input.trim() ? "6rem" : "2rem" }}
                      />
                    )}

                    {voiceError && (
                      <p className="flex items-center gap-1.5 px-3 pb-1.5 text-[11px] text-red-500">
                        <AlertTriangle className="h-3 w-3 shrink-0" /> {voiceError}
                      </p>
                    )}

                    {/* Bottom bar */}
                    {!isRecording && !recordedBlob && (
                      <div className="flex items-center justify-between px-2 pb-2 pt-1 border-t border-border/50">
                        <div className="flex items-center gap-0">
                          {([
                            { Icon: Smile,     title: "Emoji" },
                            { Icon: Paperclip, title: "Adjuntar" },
                            { Icon: FileText,  title: "Plantilla" },
                            { Icon: Zap,       title: "Sugerencia IA" },
                          ] as const).map(({ Icon, title }) => (
                            <button key={title} title={title}
                              className="p-1.5 text-muted-foreground/50 hover:text-foreground rounded-md hover:bg-muted transition-colors">
                              <Icon className="h-4 w-4" />
                            </button>
                          ))}
                          {composerMode === "message" && (selected.channel === "WHATSAPP" || selected.channel === "WHATSAPP_PERSONAL") && (
                            <>
                              <button title="Enviar ubicación de una propiedad" onClick={() => setLocationOpen(true)}
                                className="p-1.5 text-muted-foreground/60 hover:text-emerald-600 rounded-md hover:bg-muted transition-colors"><MapPin className="h-4 w-4" /></button>
                              <button title="Enviar encuesta" onClick={() => setPollOpen(true)}
                                className="p-1.5 text-muted-foreground/60 hover:text-primary rounded-md hover:bg-muted transition-colors"><BarChart3 className="h-4 w-4" /></button>
                            </>
                          )}
                          {composerMode === "message" && (
                            <button onClick={startRecording} title="Nota de voz"
                              className="p-1.5 text-muted-foreground/50 hover:text-primary rounded-md hover:bg-muted transition-colors">
                              <Mic className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={handleToggleAiHandled} disabled={aiToggleBusy} className={cn(
                            "flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 transition-colors disabled:opacity-50",
                            selected.isAiHandled
                              ? "bg-violet-100 text-violet-700"
                              : "bg-muted text-muted-foreground hover:bg-violet-50 hover:text-violet-700"
                          )}>
                            <Bot className="h-3 w-3" />
                            {selected.isAiHandled ? "IA activa" : "Activar IA"}
                          </button>
                          {/* Send + dropdown */}
                          <div className="flex">
                            <Button size="sm" disabled={!input.trim() || sendingMessage} onClick={handleSendComposer}
                              className={cn(
                                "h-8 px-3 rounded-r-none text-sm border-r border-white/20",
                                composerMode === "note" ? "bg-amber-500 hover:bg-amber-600" : ""
                              )}>
                              <Send className="h-3.5 w-3.5 mr-1" />
                              {sendingMessage ? "Enviando…" : composerMode === "note" ? "Guardar" : "Enviar"}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm"
                                  className={cn(
                                    "h-8 px-1.5 rounded-l-none text-sm",
                                    composerMode === "note" ? "bg-amber-500 hover:bg-amber-600" : ""
                                  )}>
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" side="top">
                                <DropdownMenuItem>Enviar y resolver</DropdownMenuItem>
                                <DropdownMenuItem>Enviar y dejar pendiente</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="compact"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-3"
                  >
                    <div
                      onClick={() => setComposerOpen(true)}
                      className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5 cursor-text hover:bg-muted/30 transition-colors"
                    >
                      {(() => { const I = CH[outChannel]?.Icon ?? MessageSquare; return <I className="h-4 w-4 text-muted-foreground/50 shrink-0" />; })()}
                      <span className="text-sm text-muted-foreground/60 flex-1 select-none">
                        {outChannel === "INTERNO" ? "Escribe una nota interna…" : `Mensaje vía ${CH[outChannel]?.label ?? outChannel}…`}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageCircle className="h-12 w-12 opacity-20" />
            <p className="text-sm">Selecciona una conversación</p>
          </div>
        )}
      </div>

      {/* ── Panel 3: Right Panel ─────────────────── */}
      <div className="shrink-0 border-l border-border bg-white flex overflow-hidden">
        {selected?.lead
          ? <RightPanel lead={selected.lead} conversation={selected} />
          : (
            <div className="w-10 flex items-start justify-center pt-3 text-muted-foreground">
              <User className="h-4 w-4 opacity-30" />
            </div>
          )}
      </div>
    </div>
  );
}

// ── ChatHeader ──────────────────────────────────────────
export function ChatHeader({ conversation, starred, onStar, pipelineId, stages, properties }: {
  conversation: Conversation; starred: boolean; onStar: () => void;
  pipelineId?: string | null; stages?: Stage[]; properties?: PropertyOption[];
}) {
  const router = useRouter();
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const meta = CH[conversation.channel] ?? CH.INTERNO;
  const ChIcon = meta.Icon;
  const lead = conversation.lead;
  const name = lead ? `${lead.firstName} ${lead.lastName ?? ""}`.trim() : "Sin contacto";
  const initials = lead ? `${lead.firstName[0]}${lead.lastName?.[0] ?? ""}`.toUpperCase() : "?";
  const canCreateDeal = Boolean(lead && pipelineId && stages && stages.length > 0);

  return (
    <div className="bg-white border-b border-border px-4 py-2.5 flex items-center gap-3">
      {lead ? (
        <Link href={`/leads/${lead.id}`} title="Ver ficha completa del lead" className="relative shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white"
            style={{ backgroundColor: meta.color }}>
            <ChIcon className="h-2 w-2 text-white" />
          </span>
        </Link>
      ) : (
        <div className="relative shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white"
            style={{ backgroundColor: meta.color }}>
            <ChIcon className="h-2 w-2 text-white" />
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {lead
          ? (
            <Link href={`/leads/${lead.id}`} title="Ver ficha completa del lead"
              className="text-[14px] font-semibold truncate hover:text-primary transition-colors block">
              {name}
            </Link>
          )
          : <p className="text-[14px] font-semibold truncate">{name}</p>}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{meta.label}</span>
          <span className="text-muted-foreground">·</span>
          <Badge className={cn("text-[10px] border-0 font-medium py-0 px-1.5", STATUS_COLOR[conversation.status])}>
            {STATUS_LABEL[conversation.status]}
          </Badge>
        </div>
      </div>

      {/* Action icons */}
      <div className="flex items-center gap-0.5">
        {canCreateDeal && (
          <button title="Crear negocio" onClick={() => setDealModalOpen(true)}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        )}
        <button title="Destacar" onClick={onStar}
          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-amber-400 transition-colors">
          <Star className={cn("h-4 w-4", starred && "fill-amber-400 text-amber-400")} />
        </button>
        {lead?.phone && (
          <a href={`tel:${lead.phone}`} title={`Llamar a ${lead.phone}`}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-green-600 hover:border-green-400 transition-colors">
            <Phone className="h-4 w-4" />
          </a>
        )}
        <button title="Eliminar"
          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {dealModalOpen && lead && pipelineId && stages && (
        <CreateDealModal
          workspaceId={lead.workspaceId}
          leadId={lead.id}
          leadName={name}
          pipelineId={pipelineId}
          stages={stages}
          properties={properties ?? []}
          onClose={() => setDealModalOpen(false)}
          onCreated={() => { setDealModalOpen(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ── Crear negocio desde el chat (lead ya fijo) ──────────
function CreateDealModal({ workspaceId, leadId, leadName, pipelineId, stages, properties, onClose, onCreated }: {
  workspaceId: string; leadId: string; leadName: string; pipelineId: string; stages: Stage[]; properties: PropertyOption[];
  onClose: () => void; onCreated: () => void;
}) {
  const [propertyId, setPropertyId] = useState("");
  const [propertySearch, setPropertySearch] = useState("");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("DOP");
  const [saving, setSaving] = useState(false);

  const selectedProperty = properties.find((v) => v.id === propertyId);
  const filteredProperties = properties.filter((v) =>
    `${v.title}`.toLowerCase().includes(propertySearch.toLowerCase())
  ).slice(0, 8);

  async function handleCreate() {
    if (!stageId) return;
    setSaving(true);
    await createDeal(workspaceId, pipelineId, leadId, stageId, value ? parseFloat(value) : null, currency, propertyId || undefined);
    setSaving(false);
    onCreated();
  }

  return (
    <ModalShell icon={Plus} iconColor="text-primary" iconBg="bg-primary/10"
      title="Nuevo negocio" subtitle={`Para ${leadName}`} onClose={onClose} width={440}
      footer={<>
        <div />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!stageId || saving} onClick={handleCreate}>
            {saving ? "Creando…" : "Crear negocio"}
          </Button>
        </div>
      </>}>
      <div className="p-5 space-y-3">
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
            Propiedad <span className="font-normal normal-case">(opcional)</span>
          </label>
          {selectedProperty ? (
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
              <Car className="h-4 w-4 text-gray-300 shrink-0" />
              <span className="text-sm flex-1">{selectedProperty.title}</span>
              <button onClick={() => { setPropertyId(""); setPropertySearch(""); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)}
                placeholder="Buscar propiedad…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
              {propertySearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-[180px] overflow-y-auto">
                  {filteredProperties.length === 0
                    ? <p className="text-xs text-gray-400 p-3">Sin resultados</p>
                    : filteredProperties.map((v) => (
                      <button key={v.id} onClick={() => {
                        setPropertyId(v.id);
                        if (v.priceDOP) setValue(String(v.priceDOP));
                        setPropertySearch("");
                      }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                        <Car className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                        <div>
                          <p className="font-medium text-[12px]">{v.title}</p>
                          {v.priceDOP && <p className="text-[10px] text-gray-400">{v.priceDOP.toLocaleString()} DOP</p>}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Etapa</label>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-white">
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Valor</label>
            <div className="flex gap-1.5">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-2 text-[11px] outline-none bg-white w-16">
                <option value="DOP">DOP</option>
                <option value="USD">USD</option>
              </select>
              <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary min-w-0" />
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Priority / Status helpers ───────────────────────────
const PRIORITY_BADGE: Record<string, string> = {
  BAJA:    "bg-gray-100 text-gray-500",
  MEDIA:   "bg-blue-100 text-blue-600",
  ALTA:    "bg-amber-100 text-amber-700",
  URGENTE: "bg-red-100 text-red-600",
};
const PRIORITY_LABEL: Record<string, string> = { BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", URGENTE: "Urgente" };

const APPT_TYPE_LABEL: Record<string, string> = {
  VISITA_PROPIEDAD: "Visita a Propiedad", LLAMADA: "Llamada",
  VIDEO_LLAMADA: "Video Llamada",    FIRMA_CONTRATO: "Firma de contrato",
  ENTREGA_LLAVES: "Entrega",                SEGUIMIENTO: "Seguimiento",
};
const APPT_STATUS_COLOR: Record<string, string> = {
  AGENDADA:   "bg-blue-100 text-blue-700",
  CONFIRMADA: "bg-green-100 text-green-700",
  COMPLETADA: "bg-gray-100 text-gray-500",
  CANCELADA:  "bg-red-100 text-red-600",
  NO_SHOW:    "bg-amber-100 text-amber-700",
};
const APPT_STATUS_LABEL: Record<string, string> = {
  AGENDADA: "Agendada", CONFIRMADA: "Confirmada",
  COMPLETADA: "Completada", CANCELADA: "Cancelada", NO_SHOW: "No Show",
};

// ── NotasTab ────────────────────────────────────────────
export function NotasTab({ notes, workspaceId, leadId }: { notes: Activity[]; workspaceId: string; leadId: string }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const noteList = notes.filter((a) => a.type === "NOTE_ADDED").slice().reverse();

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    await addNote(workspaceId, leadId, text.trim());
    router.refresh();
    setText("");
    setSaving(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Escribe una nota…"
          rows={3}
          className="w-full resize-none text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 outline-none placeholder:text-amber-400 text-amber-900 focus:ring-1 focus:ring-amber-300"
        />
        <div className="flex justify-end mt-1.5">
          <Button size="sm" disabled={!text.trim() || saving} onClick={save}
            className="h-7 px-3 text-xs bg-amber-500 hover:bg-amber-600">
            {saving ? "Guardando…" : "Guardar nota"}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {noteList.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 text-center mt-6">Sin notas aún</p>
        ) : noteList.map((n) => (
          <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-[12px] text-amber-900 leading-relaxed">{n.description}</p>
            <p className="text-[10px] text-amber-500/70 mt-1">{new Date(n.createdAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TareasTab ───────────────────────────────────────────
export function TareasTab({ tasks, workspaceId, leadId, showHeader = true }: { tasks: Task[]; workspaceId: string; leadId: string; showHeader?: boolean }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIA");
  const [dueAt, setDueAt] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate() {
    if (!title.trim()) return;
    setPending("creating");
    await createTask(workspaceId, leadId, title.trim(), priority as "BAJA"|"MEDIA"|"ALTA"|"URGENTE", dueAt || null);
    router.refresh();
    setTitle(""); setPriority("MEDIA"); setDueAt(""); setAdding(false); setPending(null);
  }

  async function handleToggle(id: string, done: boolean) {
    setPending(id);
    await toggleTask(id, !done);
    router.refresh();
    setPending(null);
  }

  async function handleDelete(id: string) {
    setPending(id + "-del");
    await deleteTask(id);
    router.refresh();
    setPending(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className={cn("p-3 border-b border-border flex items-center", showHeader ? "justify-between" : "justify-end")}>
        {showHeader && <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tareas ({tasks.length})</span>}
        <button onClick={() => setAdding(v => !v)}
          className="text-[11px] text-primary hover:underline flex items-center gap-1">
          + Nueva tarea
        </button>
      </div>

      {adding && (
        <div className="p-3 border-b border-border space-y-2 bg-muted/20">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de la tarea…"
            className="w-full text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary bg-white" />
          <div className="flex gap-2">
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-white">
              {["BAJA","MEDIA","ALTA","URGENTE"].map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
            <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
              className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-white" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
            <Button size="sm" disabled={!title.trim() || pending === "creating"} onClick={handleCreate} className="h-7 px-3 text-xs">
              Crear
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 text-center mt-6">Sin tareas</p>
        ) : tasks.map((t) => {
          const done = t.status === "COMPLETADA";
          return (
            <div key={t.id} className={cn("flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors", done ? "bg-muted/30 border-border/50" : "bg-white border-border")}>
              <button disabled={!!pending} onClick={() => handleToggle(t.id, done)}
                className={cn("mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                  done ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-primary"
                )}>
                {done && <CheckCheck className="h-2.5 w-2.5 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn("text-[12px] font-medium", done && "line-through text-muted-foreground")}>{t.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 font-medium", PRIORITY_BADGE[t.priority])}>
                    {PRIORITY_LABEL[t.priority]}
                  </span>
                  {t.dueAt && (
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(t.dueAt).toLocaleDateString("es-DO", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <button disabled={!!pending} onClick={() => handleDelete(t.id)}
                className="text-muted-foreground/30 hover:text-red-500 transition-colors mt-0.5 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CitasTab ────────────────────────────────────────────
export function CitasTab({ appointments, workspaceId, leadId, showHeader = true }: { appointments: Appointment[]; workspaceId: string; leadId: string; showHeader?: boolean }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", type: "VISITA_PROPIEDAD", startAt: "", endAt: "", notes: "" });
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleCreate() {
    if (!form.title.trim() || !form.startAt || !form.endAt) return;
    setPending("creating");
    await createAppointment(workspaceId, leadId, form.title, form.type, form.startAt, form.endAt, form.notes || undefined);
    router.refresh();
    setForm({ title: "", type: "VISITA_PROPIEDAD", startAt: "", endAt: "", notes: "" });
    setAdding(false); setPending(null);
  }

  async function handleStatus(id: string, status: string) {
    setPending(id);
    await updateAppointmentStatus(id, status as "AGENDADA"|"CONFIRMADA"|"COMPLETADA"|"CANCELADA"|"NO_SHOW");
    router.refresh();
    setPending(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className={cn("p-3 border-b border-border flex items-center", showHeader ? "justify-between" : "justify-end")}>
        {showHeader && <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Citas ({appointments.length})</span>}
        <button onClick={() => setAdding(v => !v)} className="text-[11px] text-primary hover:underline">+ Nueva cita</button>
      </div>

      {adding && (
        <div className="p-3 border-b border-border space-y-2 bg-muted/20">
          <input value={form.title} onChange={(e) => setField("title", e.target.value)}
            placeholder="Título de la cita…"
            className="w-full text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary bg-white" />
          <select value={form.type} onChange={(e) => setField("type", e.target.value)}
            className="w-full text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-white">
            {Object.entries(APPT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-0.5">Inicio</p>
              <input type="datetime-local" value={form.startAt} onChange={(e) => setField("startAt", e.target.value)}
                className="w-full text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-white" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-0.5">Fin</p>
              <input type="datetime-local" value={form.endAt} onChange={(e) => setField("endAt", e.target.value)}
                className="w-full text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-white" />
            </div>
          </div>
          <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)}
            placeholder="Notas opcionales…" rows={2}
            className="w-full text-xs border border-border rounded-md px-2.5 py-1.5 outline-none resize-none bg-white" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
            <Button size="sm" disabled={!form.title || !form.startAt || !form.endAt || pending === "creating"} onClick={handleCreate} className="h-7 px-3 text-xs">
              Agendar
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {appointments.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 text-center mt-6">Sin citas agendadas</p>
        ) : appointments.map((a) => (
          <div key={a.id} className="border border-border rounded-lg p-2.5 bg-white space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate">{a.title}</p>
                <p className="text-[10px] text-muted-foreground">{APPT_TYPE_LABEL[a.type]}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn("text-[10px] rounded-full px-1.5 py-0.5 font-medium shrink-0", APPT_STATUS_COLOR[a.status])}>
                    {APPT_STATUS_LABEL[a.status]}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  {Object.entries(APPT_STATUS_LABEL).map(([v, l]) => (
                    <DropdownMenuItem key={v} disabled={!!pending} onClick={() => handleStatus(a.id, v)} className="text-xs">
                      {l}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              {new Date(a.startAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}
              {" → "}
              {new Date(a.endAt).toLocaleTimeString("es-DO", { timeStyle: "short" })}
            </div>
            {a.notes && <p className="text-[11px] text-muted-foreground italic">{a.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PagosTab ────────────────────────────────────────────
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", TARJETA: "Tarjeta",
  CHEQUE: "Cheque", FINANCIAMIENTO: "Financiamiento", OTRO: "Otro",
};

export function PagosTab({ deals, workspaceId }: { deals: Deal[]; workspaceId: string }) {
  const router = useRouter();
  const [formFor, setFormFor] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: "", currency: "DOP", method: "EFECTIVO", paidAt: new Date().toISOString().slice(0, 10), note: "" });
  const [pending, setPending] = useState(false);

  const fmt = (v: number, cur: string) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: cur === "USD" ? "USD" : "DOP", maximumFractionDigits: 0 }).format(v);

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function openForm(dealId: string, currency: string) {
    setForm({ amount: "", currency, method: "EFECTIVO", paidAt: new Date().toISOString().slice(0, 10), note: "" });
    setFormFor(dealId);
  }

  async function handleRegister(dealId: string) {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return;
    setPending(true);
    await registerPayment(workspaceId, dealId, amount, form.currency, form.method as "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "CHEQUE" | "FINANCIAMIENTO" | "OTRO", form.paidAt, form.note || undefined);
    router.refresh();
    setFormFor(null);
    setPending(false);
  }

  async function handleDeletePayment(id: string) {
    await deletePayment(id);
    router.refresh();
  }

  const open = deals.filter(d => d.status === "OPEN");
  const won  = deals.filter(d => d.status === "WON");
  const totalOpen = open.reduce((s, d) => s + (d.value ?? 0), 0);
  const totalWon  = won.reduce((s, d) => s + (d.value ?? 0), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resumen financiero</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
            <p className="text-[10px] text-blue-500 font-medium">En curso</p>
            <p className="text-[13px] font-bold text-blue-700">{fmt(totalOpen, "DOP")}</p>
            <p className="text-[10px] text-blue-400">{open.length} negocio{open.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-lg p-2 text-center">
            <p className="text-[10px] text-green-600 font-medium">Ganados</p>
            <p className="text-[13px] font-bold text-green-700">{fmt(totalWon, "DOP")}</p>
            <p className="text-[10px] text-green-400">{won.length} negocio{won.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {deals.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 text-center mt-6">Sin negocios</p>
        ) : deals.map((d) => {
          const paid = d.payments.reduce((s, p) => s + p.amount, 0);
          const remaining = d.value != null ? Math.max(d.value - paid, 0) : null;
          return (
            <div key={d.id} className="border border-border rounded-lg p-2.5 bg-white space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">
                    {d.property ? `${d.property.title}` : "Sin propiedad"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{d.stage?.name ?? "Sin etapa"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-bold">{d.value ? fmt(d.value, d.currency) : "—"}</p>
                  <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 font-medium",
                    d.status === "WON" ? "bg-green-100 text-green-700"
                    : d.status === "LOST" ? "bg-red-100 text-red-600"
                    : "bg-blue-100 text-blue-600"
                  )}>
                    {d.status === "WON" ? "Ganado" : d.status === "LOST" ? "Perdido" : "Abierto"}
                  </span>
                </div>
              </div>

              {d.value != null && (
                <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30 rounded-md px-2 py-1">
                  <span>Pagado: <span className="font-medium text-foreground">{fmt(paid, d.currency)}</span></span>
                  <span>Resta: <span className="font-medium text-foreground">{fmt(remaining ?? 0, d.currency)}</span></span>
                </div>
              )}

              {d.payments.length > 0 && (
                <div className="space-y-1">
                  {d.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-[10px] bg-muted/20 rounded px-2 py-1">
                      <span>
                        <span className="font-medium text-foreground">{fmt(p.amount, p.currency)}</span>
                        <span className="text-muted-foreground"> · {PAYMENT_METHOD_LABEL[p.method] ?? p.method} · {new Date(p.paidAt).toLocaleDateString("es-DO", { day: "2-digit", month: "short" })}</span>
                        {p.note && <span className="text-muted-foreground italic"> · {p.note}</span>}
                      </span>
                      <button onClick={() => handleDeletePayment(p.id)} title="Eliminar pago"
                        className="text-muted-foreground/40 hover:text-red-500 shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {formFor === d.id ? (
                <div className="space-y-1.5 bg-muted/20 rounded-md p-2">
                  <div className="flex gap-1.5">
                    <input type="number" min="0" step="0.01" placeholder="Monto" value={form.amount}
                      onChange={(e) => setField("amount", e.target.value)}
                      className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-white" />
                    <select value={form.currency} onChange={(e) => setField("currency", e.target.value)}
                      className="text-xs border border-border rounded-md px-1.5 py-1.5 outline-none bg-white">
                      <option value="DOP">DOP</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <select value={form.method} onChange={(e) => setField("method", e.target.value)}
                      className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-white">
                      {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input type="date" value={form.paidAt} onChange={(e) => setField("paidAt", e.target.value)}
                      className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-white" />
                  </div>
                  <input value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Nota (opcional)…"
                    className="w-full text-xs border border-border rounded-md px-2 py-1.5 outline-none bg-white" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setFormFor(null)} className="text-[11px] text-muted-foreground hover:text-foreground">Cancelar</button>
                    <Button size="sm" disabled={!form.amount || pending} onClick={() => handleRegister(d.id)} className="h-7 px-3 text-xs">
                      {pending ? "Guardando…" : "Guardar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => openForm(d.id, d.currency)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" />Registrar pago
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DocumentosTab ───────────────────────────────────────
export function DocumentosTab({ showHeader = true }: { showHeader?: boolean } = {}) {
  return (
    <div className="flex flex-col h-full">
      <div className={cn("p-3 border-b border-border flex items-center", showHeader ? "justify-between" : "justify-end")}>
        {showHeader && <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Documentos</span>}
        <button disabled className="text-[11px] text-muted-foreground/40 cursor-not-allowed">+ Subir</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-12 w-12 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
          <Folder className="h-5 w-5 text-muted-foreground/30" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Sin documentos</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Contratos, fichas técnicas y archivos del cliente aparecerán aquí</p>
        </div>
      </div>
    </div>
  );
}

// ── RightPanel ─────────────────────────────────────────
// Acordeón: todas las secciones apiladas y visibles a la vez (mismo estilo que la
// columna de Actividades del detalle de lead), en vez del strip de íconos + un solo
// tab a la vez. Actividades va primero, Detalles del contacto justo debajo.
function RightPanel({ lead, conversation }: { lead: Lead; conversation: Conversation }) {
  const [open, setOpen] = useState<Set<string>>(new Set(["activities"]));

  function toggle(key: string) {
    setOpen((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  }

  const sections: { key: string; title: string; body: React.ReactNode }[] = [
    { key: "activities", title: `Actividades (${lead.activities.length})`, body: <ActivitiesTab activities={lead.activities} /> },
    { key: "contact", title: "Detalles del contacto", body: <ContactDetails lead={lead} conversation={conversation} showHeader={false} /> },
    { key: "tasks", title: `Tareas (${lead.tasks.length})`, body: <TareasTab tasks={lead.tasks} workspaceId={lead.workspaceId} leadId={lead.id} showHeader={false} /> },
    { key: "notes", title: "Notas", body: <NotasTab notes={lead.activities} workspaceId={lead.workspaceId} leadId={lead.id} /> },
    { key: "appointments", title: `Citas (${lead.appointments.length})`, body: <CitasTab appointments={lead.appointments} workspaceId={lead.workspaceId} leadId={lead.id} showHeader={false} /> },
    { key: "documents", title: "Documentos", body: <DocumentosTab showHeader={false} /> },
    { key: "payments", title: `Pagos (${lead.deals.length})`, body: <PagosTab deals={lead.deals} workspaceId={lead.workspaceId} /> },
  ];

  return (
    <div className="w-[300px] shrink-0 overflow-y-auto">
      {sections.map((s) => (
        <CollapsibleSection key={s.key} title={s.title} open={open.has(s.key)} onToggle={() => toggle(s.key)}>
          <div className={cn("-mx-4 -mb-3", s.key === "activities" && "max-h-[25vh] overflow-y-auto")}>{s.body}</div>
        </CollapsibleSection>
      ))}
    </div>
  );
}

export function ActivitiesTab({ activities }: { activities: Activity[] }) {
  return (
    <ActivityTimeline
      activities={activities}
      emptyIcon={Clock}
      emptyLabel="Sin actividades aún"
    />
  );
}

// ── ContactDetails ──────────────────────────────────────
export function ContactDetails({ lead, conversation, showHeader = true }: { lead: Lead; conversation: Conversation; showHeader?: boolean }) {
  const [activeTab, setActiveTab] = useState<"fields" | "dnd" | "actions">("fields");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["contacto", "lead"]));

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  }

  const initials = `${lead.firstName[0]}${lead.lastName?.[0] ?? ""}`.toUpperCase();
  const meta = CH[conversation.channel] ?? CH.INTERNO;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        {showHeader && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Detalles del contacto
          </p>
        )}
        <div className="flex items-center gap-2.5">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <EditableName leadId={lead.id} firstName={lead.firstName} lastName={lead.lastName} phone={lead.phone} className="flex-1" />
              <Link href={`/leads/${lead.id}`} title="Ver ficha completa del lead"
                className="text-muted-foreground shrink-0 hover:text-primary transition-colors">
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <p className="text-[11px] text-muted-foreground">{lead.phone}</p>
          </div>
        </div>
      </div>

      {/* Owner + Tags */}
      <div className="px-4 py-3 border-b border-border space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Responsable</span>
          <button className="flex items-center gap-1 text-[11px] text-foreground border border-border rounded px-2 py-0.5 hover:bg-muted transition-colors">
            <User className="h-3 w-3" />Lucas
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Etiquetas</span>
          <button className="flex items-center gap-1 text-[11px] text-primary hover:underline">
            <Tag className="h-3 w-3" />Agregar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border text-[11px] font-medium px-1">
        {(["fields", "dnd", "actions"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn(
              "flex-1 py-2 transition-colors",
              activeTab === t
                ? "border-b-2 border-primary text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "fields" ? "Campos" : t === "dnd" ? "DND" : "Acciones"}
          </button>
        ))}
      </div>

      {/* Fields content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "fields" && (
          <>
            <CollapsibleSection
              title="Contacto"
              open={openSections.has("contacto")}
              onToggle={() => toggleSection("contacto")}
            >
              <Field label="Teléfono" value={lead.phone} />
              <Field label="Fuente" value={lead.source} />
              <Field label="Canal" value={meta.label} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Lead"
              open={openSections.has("lead")}
              onToggle={() => toggleSection("lead")}
            >
              <Field label="Etapa" value={lead.stage ?? "Sin etapa"} />
              <Field label="Score" value={`${lead.score} / 100`} />
            </CollapsibleSection>

            <CollapsibleSection
              title="IA"
              open={openSections.has("ia")}
              onToggle={() => toggleSection("ia")}
            >
              <Field label="Agente IA" value="Sin asignar" />
              <Field label="Última acción" value="—" />
            </CollapsibleSection>
          </>
        )}

        {activeTab === "dnd" && (
          <div className="p-4 space-y-3">
            {["WhatsApp", "SMS", "Email", "Llamada"].map((ch) => (
              <div key={ch} className="flex items-center justify-between">
                <span className="text-[12px] text-foreground">{ch}</span>
                <button className="h-5 w-9 rounded-full bg-muted border border-border relative transition-colors">
                  <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform" />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "actions" && (
          <div className="p-4 space-y-2">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 justify-start">
              <Phone className="h-3.5 w-3.5" />Llamar
            </Button>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 justify-start">
              <Mail className="h-3.5 w-3.5" />Enviar email
            </Button>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 justify-start">
              <ExternalLink className="h-3.5 w-3.5" />Ver perfil completo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CollapsibleSection({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/60">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-[12px] font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}
