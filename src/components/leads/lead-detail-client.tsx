"use client";

import { EditableName } from "@/components/leads/editable-name";
import { stageBadgeClass } from "@/lib/pipeline/default-stages";
import { desiredSummary } from "@/lib/properties/labels";
import type { ListingType, PropertyType } from "@prisma/client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Mail, MessageCircle, Star, User, Tag as TagIcon,
  ChevronDown, Calendar, Send, Bot, Trash2, Plus, X,
  FileText, Smile, Paperclip, Zap, Loader2, ShieldAlert, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CH, ChatHeader, DealsStrip, ActivityEvent, MessageStatusTick, msgTime,
  buildTimeline, groupTimeline, ActivitiesTab, TareasTab, NotasTab, CitasTab,
  PagosTab, DocumentosTab, CollapsibleSection, Field,
  type Stage, type Lead as BaseLead, type Conversation as BaseConversation,
} from "@/components/conversaciones/conversaciones-client";
import { sendMessage, setConversationAiHandled, markConversationRead, type Channel } from "@/app/actions/conversaciones";
import { updateLeadAssignee, addTagToLead, removeTagFromLead } from "@/app/actions/leads";
import { createOrUpdateDdc, approveDdc, rejectDdc } from "@/app/actions/due-diligence";
import type { IdDocumentType } from "@prisma/client";

const SOURCE_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp", FACEBOOK: "Facebook", INSTAGRAM: "Instagram",
  TIKTOK: "TikTok", WEB: "Web", REFERIDO: "Referido",
  MANUAL: "Manual", LLAMADA: "Llamada", EMAIL: "Email", WALK_IN: "Walk-in",
};

function scoreColor(s: number) {
  if (s >= 80) return "text-green-600";
  if (s >= 50) return "text-amber-600";
  return "text-gray-400";
}

// ── Types ────────────────────────────────────────────────
// Conversation sin el campo `lead` anidado (ya estamos dentro de la página del lead,
// no hace falta duplicarlo) — se reconstruye al vuelo solo para reutilizar ChatHeader.
type ExtConversation = Omit<BaseConversation, "lead"> & {
  workspaceId: string; externalId: string | null; createdAt: string; updatedAt: string;
};
type LeadUser = { id: string; name: string };
type LeadTag = { id: string; name: string; color: string };
type Ddc = {
  id: string; idDocumentType: IdDocumentType; idDocumentNumber: string; fullLegalName: string;
  isPep: boolean; riskLevel: "BAJO" | "MEDIO" | "ALTO" | null; status: "PENDIENTE" | "EN_REVISION" | "APROBADO" | "RECHAZADO";
  rejectionReason: string | null; createdAt: string;
};
type ExtLead = BaseLead & {
  email: string | null; whatsapp: string | null; sourceDetail: string | null;
  isActive: boolean; createdAt: string; updatedAt: string; lastContact: string | null;
  notes: string | null;
  budgetMin: number | null; budgetMax: number | null; budgetCurrency: string;
  desiredPropertyType: PropertyType | null; desiredListingType: ListingType | null;
  desiredCity: string | null; desiredSector: string | null; desiredBedrooms: number | null;
  assignedUser: LeadUser | null;
  tags: LeadTag[];
  interestedProperty: { id: string; title: string } | null;
  conversations: ExtConversation[];
  dueDiligences: Ddc[];
};

interface LeadDetailClientProps {
  lead: ExtLead;
  users: LeadUser[];
  stages: Stage[];
  workspaceId: string;
  canManage: boolean;
}

function fmtMoney(v: number, cur: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: cur === "USD" ? "USD" : "DOP", maximumFractionDigits: 0 }).format(v);
}

// ══════════════════════════════════════════════════════
export function LeadDetailClient({ lead, users, stages, workspaceId, canManage }: LeadDetailClientProps) {
  const router = useRouter();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(lead.conversations[0]?.id ?? null);
  const [rightOpen, setRightOpen] = useState<Set<string>>(new Set(["activities"]));

  useEffect(() => {
    if (selectedConvId && !lead.conversations.some((c) => c.id === selectedConvId)) {
      setSelectedConvId(lead.conversations[0]?.id ?? null);
    }
  }, [lead.conversations, selectedConvId]);

  const selected = lead.conversations.find((c) => c.id === selectedConvId) ?? null;

  const fullName = `${lead.firstName} ${lead.lastName ?? ""}`.trim();
  const initials = `${lead.firstName[0]}${lead.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header de página */}
      <div className="h-12 flex items-center gap-3 border-b border-border bg-card px-3 shrink-0">
        <button onClick={() => router.push("/leads")} title="Volver a Leads"
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="text-[11px] font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <h1 className="text-[14px] font-semibold text-foreground truncate">{fullName}</h1>
        {lead.stage && (
          <Badge className={cn("text-[11px] border-0 font-medium shrink-0", stageBadgeClass(lead.stage))}>
            {lead.stage}
          </Badge>
        )}
        <div className={cn("flex items-center gap-1 text-[12px] font-semibold shrink-0", scoreColor(lead.score))}>
          <Star className="h-3 w-3" />{lead.score}
        </div>
      </div>

      {/* 3 columnas: detalles del contacto | chat (centro) | actividades hacia abajo */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Columna 1: Detalles del contacto (enriquecido) ── */}
        <div className="w-[300px] shrink-0 border-r border-border bg-white overflow-y-auto">
          <ContactDetailsPanel
            lead={lead} users={users} workspaceId={workspaceId}
            conversation={selected}
          />
        </div>

        {/* ── Columna 2: Chat (centro) ─────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F5F5] min-w-0">
          {selected ? (
            <ChatColumn
              key={selected.id}
              conversation={selected}
              lead={lead}
              stages={stages}
              onChangeConversation={setSelectedConvId}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageCircle className="h-12 w-12 opacity-20" />
              <p className="text-sm">Este lead aún no tiene conversaciones</p>
            </div>
          )}
        </div>

        {/* ── Columna 3: Actividades hacia abajo ──── */}
        <div className="w-[320px] shrink-0 border-l border-border bg-white overflow-y-auto">
          <RightStack
            lead={lead} workspaceId={workspaceId} canManage={canManage}
            open={rightOpen} setOpen={setRightOpen}
          />
        </div>
      </div>
    </div>
  );
}

// ── Columna de chat ──────────────────────────────────────
function ChatColumn({ conversation, lead, stages, onChangeConversation }: {
  conversation: ExtConversation; lead: ExtLead; stages: Stage[];
  onChangeConversation: (id: string) => void;
}) {
  const router = useRouter();
  const [starred, setStarred] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(conversation.messages.length);

  useEffect(() => {
    const switched = prevCountRef.current !== conversation.messages.length;
    prevCountRef.current = conversation.messages.length;
    bottomRef.current?.scrollIntoView({ behavior: switched ? "smooth" : "auto" });
  }, [conversation.messages.length]);

  useEffect(() => {
    const hasUnread = conversation.messages.some((m) => !m.isRead && m.direction === "INBOUND");
    if (hasUnread) markConversationRead(conversation.id).then(() => router.refresh());
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const timeline = useMemo(
    () => groupTimeline(buildTimeline(conversation.messages, lead.activities)),
    [conversation.messages, lead.activities],
  );

  // Objeto compatible con el tipo Conversation de conversaciones-client, para reutilizar ChatHeader tal cual.
  const conversationForHeader = { ...conversation, lead };

  return (
    <>
      {lead.conversations.length > 1 && (
        <div className="flex items-center gap-1.5 px-3 pt-2 bg-[#F5F5F5]">
          {lead.conversations.map((c) => {
            const meta = CH[c.channel] ?? CH.INTERNO;
            const Icon = meta.Icon;
            const active = c.id === conversation.id;
            return (
              <button key={c.id} onClick={() => onChangeConversation(c.id)}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors",
                  active ? "bg-white border-border shadow-sm text-foreground" : "border-transparent text-muted-foreground hover:bg-white/60"
                )}>
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full" style={{ backgroundColor: meta.color }}>
                  <Icon className="h-2 w-2 text-white" />
                </span>
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      <ChatHeader conversation={conversationForHeader} starred={starred} onStar={() => setStarred((v) => !v)} />
      <DealsStrip deals={lead.deals} stages={stages} />

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {timeline.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium px-2">
                <Calendar className="h-3 w-3" />{group.label}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            {group.items.map((item) => {
              if (item.kind === "activity") return <ActivityEvent key={item.data.id} activity={item.data} />;
              const msg = item.data;
              const isOut = msg.direction === "OUTBOUND";
              return (
                <div key={msg.id} className={cn("flex gap-2 mb-1", isOut ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[70%] flex flex-col", isOut ? "items-end" : "items-start")}>
                    <div className={cn(
                      "px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed",
                      isOut ? "bg-primary text-white rounded-tr-sm" : "bg-white border border-border/60 rounded-tl-sm shadow-sm"
                    )}>
                      {msg.content}
                    </div>
                    <div className={cn("flex items-center gap-1 mt-0.5 px-1", isOut ? "justify-end" : "justify-start")}>
                      <span className="text-[10px] text-muted-foreground">{msgTime(msg.sentAt)}</span>
                      {isOut && <MessageStatusTick status={msg.status} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer conversation={conversation} />
    </>
  );
}

// ── Composer ─────────────────────────────────────────────
function Composer({ conversation }: { conversation: ExtConversation }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const focusOnMount = useCallback((el: HTMLTextAreaElement | null) => { el?.focus(); }, []);

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    await sendMessage(conversation.id, conversation.channel as Channel, input.trim());
    setInput("");
    setSending(false);
    router.refresh();
  }

  async function handleToggleAi() {
    setAiBusy(true);
    await setConversationAiHandled(conversation.id, !conversation.isAiHandled);
    router.refresh();
    setAiBusy(false);
  }

  const meta = CH[conversation.channel] ?? CH.INTERNO;

  return (
    <div className="bg-white border-t border-border">
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div key="expanded" initial={{ height: 44, opacity: 0.6 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 44, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="overflow-hidden border border-border rounded-lg mx-3 mb-3 mt-2">
            <div className="px-3 pt-2 pb-0.5 text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full" style={{ backgroundColor: meta.color }}>
                <meta.Icon className="h-2 w-2 text-white" />
              </span>
              {meta.label}
            </div>
            <textarea
              ref={focusOnMount}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => { if (!input.trim()) setFocused(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                if (e.key === "Escape") { setOpen(false); setFocused(false); }
              }}
              placeholder="Escribe un mensaje…"
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 leading-relaxed px-3 py-1.5 transition-all duration-200"
              style={{ height: focused || input.trim() ? "6rem" : "2rem" }}
            />
            <div className="flex items-center justify-between px-2 pb-2 pt-1 border-t border-border/50">
              <div className="flex items-center gap-0">
                {[Smile, Paperclip, FileText, Zap].map((Icon, i) => (
                  <button key={i} className="p-1.5 text-muted-foreground/50 hover:text-foreground rounded-md hover:bg-muted transition-colors">
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleToggleAi} disabled={aiBusy} className={cn(
                  "flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 transition-colors disabled:opacity-50",
                  conversation.isAiHandled ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground hover:bg-violet-50 hover:text-violet-700"
                )}>
                  <Bot className="h-3 w-3" />
                  {conversation.isAiHandled ? "IA activa" : "Activar IA"}
                </button>
                <Button size="sm" disabled={!input.trim() || sending} onClick={handleSend} className="h-8 px-3 text-sm">
                  <Send className="h-3.5 w-3.5 mr-1" />
                  {sending ? "Enviando…" : "Enviar"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="compact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-3">
            <div onClick={() => setOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5 cursor-text hover:bg-muted/30 transition-colors">
              <meta.Icon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              <span className="text-sm text-muted-foreground/60 flex-1 select-none">Mensaje vía {meta.label}…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Columna 2: Detalles del contacto (enriquecido) ───────
function ContactDetailsPanel({ lead, users, workspaceId, conversation }: {
  lead: ExtLead; users: LeadUser[]; workspaceId: string;
  conversation: ExtConversation | null;
}) {
  const router = useRouter();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["contacto", "lead"]));
  const [tagInput, setTagInput] = useState("");
  const [tagPending, setTagPending] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  }

  const fullName = `${lead.firstName} ${lead.lastName ?? ""}`.trim();
  const initials = `${lead.firstName[0]}${lead.lastName?.[0] ?? ""}`.toUpperCase();
  const totalOpenValue = lead.deals.filter((d) => d.status === "OPEN").reduce((s, d) => s + (d.value ?? 0), 0);
  const totalWonValue = lead.deals.filter((d) => d.status === "WON").reduce((s, d) => s + (d.value ?? 0), 0);
  const hasBudget = lead.budgetMin != null || lead.budgetMax != null;
  const hasDesired = !!desiredSummary(lead);
  const lastAiAction = lead.activities.filter((a) => a.type === "AI_ACTION").at(-1);

  async function assignTo(userId: string | null) {
    setAssignBusy(true);
    await updateLeadAssignee(lead.id, userId);
    router.refresh();
    setAssignBusy(false);
  }

  async function submitTag() {
    if (!tagInput.trim()) return;
    setTagPending(true);
    await addTagToLead(workspaceId, lead.id, tagInput.trim());
    setTagInput("");
    router.refresh();
    setTagPending(false);
  }

  async function removeTag(tagId: string) {
    await removeTagFromLead(lead.id, tagId);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar a ${fullName}? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    await fetch(`/api/leads?id=${lead.id}`, { method: "DELETE" });
    router.push("/leads");
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Detalles del contacto
        </p>
        <div className="flex items-center gap-2.5">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <EditableName leadId={lead.id} firstName={lead.firstName} lastName={lead.lastName} phone={lead.phone} />
            <p className="text-[11px] text-muted-foreground">{lead.phone}</p>
          </div>
        </div>
      </div>

      {/* Responsable + Tags */}
      <div className="px-4 py-3 border-b border-border space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Responsable</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button disabled={assignBusy} className="flex items-center gap-1 text-[11px] text-foreground border border-border rounded px-2 py-0.5 hover:bg-muted transition-colors disabled:opacity-50">
                <User className="h-3 w-3" />{lead.assignedUser?.name ?? "Sin asignar"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => assignTo(null)}>Sin asignar</DropdownMenuItem>
              {users.map((u) => (
                <DropdownMenuItem key={u.id} onClick={() => assignTo(u.id)} className={cn(lead.assignedUser?.id === u.id && "font-semibold text-primary")}>
                  {u.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">Etiquetas</span>
          <div className="flex flex-wrap gap-1 justify-end">
            {lead.tags.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-full text-[10px] font-medium px-2 py-0.5"
                style={{ backgroundColor: t.color + "20", color: t.color }}>
                {t.name}
                <button onClick={() => removeTag(t.id)} className="hover:opacity-60"><X className="h-2.5 w-2.5" /></button>
              </span>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <TagIcon className="h-3 w-3" />Agregar
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="end">
                <div className="flex gap-1.5">
                  <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitTag(); }}
                    placeholder="Nombre de etiqueta…" autoFocus
                    className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
                  <Button size="sm" disabled={!tagInput.trim() || tagPending} onClick={submitTag} className="h-7 px-2 text-xs shrink-0">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Secciones */}
      <CollapsibleSection title="Contacto" open={openSections.has("contacto")} onToggle={() => toggleSection("contacto")}>
        <Field label="Teléfono" value={lead.phone} />
        {lead.email && <Field label="Email" value={lead.email} />}
        <Field label="Fuente" value={SOURCE_LABELS[lead.source] ?? lead.source} />
        {lead.sourceDetail && <Field label="Detalle" value={lead.sourceDetail} />}
        {conversation && <Field label="Canal" value={(CH[conversation.channel] ?? CH.INTERNO).label} />}
      </CollapsibleSection>

      <CollapsibleSection title="Lead" open={openSections.has("lead")} onToggle={() => toggleSection("lead")}>
        <Field label="Etapa" value={lead.stage ?? "Sin etapa"} />
        <Field label="Score" value={`${lead.score} / 100`} />
        <Field label="Creado" value={new Date(lead.createdAt).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })} />
        {lead.lastContact && (
          <Field label="Último contacto" value={new Date(lead.lastContact).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })} />
        )}
      </CollapsibleSection>

      {(hasDesired || hasBudget || lead.interestedProperty) && (
        <CollapsibleSection title="Interés" open={openSections.has("interes")} onToggle={() => toggleSection("interes")}>
          {hasDesired && (
            <Field label="Busca" value={desiredSummary(lead)} />
          )}
          {hasBudget && (
            <Field label="Presupuesto" value={
              `${lead.budgetMin != null ? fmtMoney(lead.budgetMin, lead.budgetCurrency) : "—"} – ${lead.budgetMax != null ? fmtMoney(lead.budgetMax, lead.budgetCurrency) : "—"}`
            } />
          )}
          {lead.interestedProperty && (
            <Field label="Propiedad de interés" value={`${lead.interestedProperty.title}`} />
          )}
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Negocios" open={openSections.has("negocios")} onToggle={() => toggleSection("negocios")}>
        <Field label="Total" value={`${lead.deals.length} negocio${lead.deals.length !== 1 ? "s" : ""}`} />
        <Field label="En curso" value={fmtMoney(totalOpenValue, "DOP")} />
        <Field label="Ganado" value={fmtMoney(totalWonValue, "DOP")} />
      </CollapsibleSection>

      <CollapsibleSection title="No molestar" open={openSections.has("dnd")} onToggle={() => toggleSection("dnd")}>
        {["WhatsApp", "SMS", "Email", "Llamada"].map((ch) => (
          <div key={ch} className="flex items-center justify-between">
            <span className="text-[12px] text-foreground">{ch}</span>
            <button className="h-5 w-9 rounded-full bg-muted border border-border relative transition-colors">
              <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform" />
            </button>
          </div>
        ))}
      </CollapsibleSection>

      <CollapsibleSection title="IA" open={openSections.has("ia")} onToggle={() => toggleSection("ia")}>
        <Field label="IA en esta conversación" value={conversation ? (conversation.isAiHandled ? "Activa" : "Pausada") : "—"} />
        <Field label="Última acción IA" value={lastAiAction ? lastAiAction.description : "—"} />
      </CollapsibleSection>

      {/* Acciones — siempre visible, justo debajo de IA.
          Solo lo que no existe ya en otro control de esta misma vista: llamar y
          eliminar están en el header del chat, agendar/crear tarea/nota ya tienen su
          propio "+" en la columna de Actividades, activar IA está en el composer, y
          ganado/perdido ya se marcan directo en el track de negocio del chat. */}
      <div className="px-4 py-3 border-t border-border/60 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Acciones</p>

        <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 w-full h-8 px-2.5 text-xs rounded-md border border-border hover:bg-muted transition-colors">
          <MessageCircle className="h-3.5 w-3.5 text-green-600" />Abrir WhatsApp
        </a>
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-2 w-full h-8 px-2.5 text-xs rounded-md border border-border hover:bg-muted transition-colors">
            <Mail className="h-3.5 w-3.5 text-blue-600" />Enviar email
          </a>
        )}

        <button onClick={handleDelete} disabled={deleting}
          className="flex items-center gap-2 w-full h-8 px-2.5 text-xs rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50 mt-1">
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Eliminar lead
        </button>
      </div>
    </div>
  );
}

// ── Columna 3: Actividades hacia abajo ───────────────────
function RightStack({ lead, workspaceId, canManage, open, setOpen }: {
  lead: ExtLead; workspaceId: string; canManage: boolean;
  open: Set<string>; setOpen: (fn: (prev: Set<string>) => Set<string>) => void;
}) {
  function toggle(key: string) {
    setOpen((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  }

  const sections: { key: string; title: string; body: React.ReactNode }[] = [
    { key: "activities", title: `Actividades (${lead.activities.length})`, body: <ActivitiesTab activities={lead.activities} /> },
    { key: "tasks", title: `Tareas (${lead.tasks.length})`, body: <TareasTab tasks={lead.tasks} workspaceId={workspaceId} leadId={lead.id} showHeader={false} /> },
    { key: "notes", title: "Notas", body: <NotasTab notes={lead.activities} workspaceId={workspaceId} leadId={lead.id} /> },
    { key: "appointments", title: `Citas (${lead.appointments.length})`, body: <CitasTab appointments={lead.appointments} workspaceId={workspaceId} leadId={lead.id} showHeader={false} /> },
    { key: "documents", title: "Documentos", body: <DocumentosTab showHeader={false} /> },
    { key: "payments", title: `Pagos (${lead.deals.length})`, body: <PagosTab deals={lead.deals} workspaceId={workspaceId} /> },
    { key: "ddc", title: `Debida Diligencia (${lead.dueDiligences.length})`, body: <DueDiligenceTab lead={lead} workspaceId={workspaceId} canManage={canManage} /> },
  ];

  return (
    <div className="flex flex-col">
      {sections.map((s) => (
        <CollapsibleSection key={s.key} title={s.title} open={open.has(s.key)} onToggle={() => toggle(s.key)}>
          <div className={cn("-mx-4 -mb-3", s.key === "activities" && "max-h-[25vh] overflow-y-auto")}>{s.body}</div>
        </CollapsibleSection>
      ))}
    </div>
  );
}

// ── Debida Diligencia del Cliente (Fase 2B) ─────────────
const DDC_STATUS_LABELS: Record<string, string> = { PENDIENTE: "Pendiente", EN_REVISION: "En revisión", APROBADO: "Aprobado", RECHAZADO: "Rechazado" };

function DueDiligenceTab({ lead, workspaceId, canManage }: { lead: ExtLead; workspaceId: string; canManage: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [fullLegalName, setFullLegalName] = useState("");
  const [idDocumentType, setIdDocumentType] = useState<IdDocumentType>("CEDULA");
  const [idDocumentNumber, setIdDocumentNumber] = useState("");
  const [isPep, setIsPep] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!fullLegalName.trim() || !idDocumentNumber.trim()) return;
    setBusy(true);
    await createOrUpdateDdc(null, lead.id, workspaceId, { idDocumentType, idDocumentNumber, fullLegalName, isPep });
    setBusy(false); setCreating(false); setFullLegalName(""); setIdDocumentNumber(""); setIsPep(false);
    router.refresh();
  }
  async function handleApprove(id: string) {
    setBusy(true); await approveDdc(id); setBusy(false); router.refresh();
  }
  async function handleReject(id: string) {
    const reason = prompt("Motivo del rechazo:");
    if (!reason) return;
    setBusy(true); await rejectDdc(id, reason); setBusy(false); router.refresh();
  }

  return (
    <div className="px-4 py-2 space-y-2">
      {lead.dueDiligences.length === 0 && !creating && (
        <p className="text-[12px] text-muted-foreground">Sin Debida Diligencia registrada — es obligatoria antes de completar una venta a este cliente.</p>
      )}
      {lead.dueDiligences.map((d) => {
        const statusCls = d.status === "APROBADO" ? "bg-green-100 text-green-700" : d.status === "RECHAZADO" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
        const riskCls = d.riskLevel === "ALTO" ? "bg-red-100 text-red-700" : d.riskLevel === "MEDIO" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
        return (
          <div key={d.id} className="border border-border rounded-lg p-2.5 text-[12px]">
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold">{d.fullLegalName}</span>
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded ml-auto", statusCls)}>{DDC_STATUS_LABELS[d.status]}</span>
            </div>
            <p className="text-muted-foreground">{d.idDocumentType} {d.idDocumentNumber}</p>
            {d.riskLevel && <span className={cn("inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1", riskCls)}>Riesgo {d.riskLevel}</span>}
            {d.isPep && <p className="text-red-600 font-medium mt-1">Persona Expuesta Políticamente</p>}
            {d.rejectionReason && <p className="text-red-600 mt-1">Rechazada: {d.rejectionReason}</p>}
            {canManage && d.status !== "APROBADO" && d.status !== "RECHAZADO" && (
              <div className="flex gap-2 mt-1.5">
                <button onClick={() => handleApprove(d.id)} disabled={busy} className="flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1"><CheckCircle2 className="h-3 w-3" /> Aprobar</button>
                <button onClick={() => handleReject(d.id)} disabled={busy} className="flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1"><XCircle className="h-3 w-3" /> Rechazar</button>
              </div>
            )}
          </div>
        );
      })}
      {creating ? (
        <div className="border border-border rounded-lg p-2.5 space-y-2">
          <input value={fullLegalName} onChange={(e) => setFullLegalName(e.target.value)} placeholder="Nombre legal completo" className="w-full text-[12px] border border-border rounded-md px-2 py-1.5" />
          <div className="grid grid-cols-2 gap-2">
            <select value={idDocumentType} onChange={(e) => setIdDocumentType(e.target.value as IdDocumentType)} className="text-[12px] border border-border rounded-md px-2 py-1.5 bg-white">
              <option value="CEDULA">Cédula</option><option value="PASAPORTE">Pasaporte</option><option value="RNC">RNC</option><option value="OTRO">Otro</option>
            </select>
            <input value={idDocumentNumber} onChange={(e) => setIdDocumentNumber(e.target.value)} placeholder="Número" className="text-[12px] border border-border rounded-md px-2 py-1.5" />
          </div>
          <label className="flex items-center gap-1.5 text-[12px]">
            <input type="checkbox" checked={isPep} onChange={(e) => setIsPep(e.target.checked)} /> Persona Expuesta Políticamente
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={busy} className="h-7 text-xs flex-1">{busy ? "Guardando…" : "Crear"}</Button>
            <button onClick={() => setCreating(false)} className="text-[11px] text-muted-foreground px-2">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="text-[11px] text-primary hover:underline">+ Nueva Debida Diligencia</button>
      )}
    </div>
  );
}
