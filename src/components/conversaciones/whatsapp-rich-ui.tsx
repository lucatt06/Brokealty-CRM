"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronDown, ExternalLink, Loader2, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteMessageForEveryone, reactToMessage, sendPoll, sendPropertyLocation } from "@/app/actions/whatsapp-rich";

/** Campos mínimos del mensaje que usa este módulo (compatible con `Message` de conversaciones-client). */
export type RichMsg = {
  id: string; direction: string; content: string; mediaType: string | null; sentAt: string;
  meta?: unknown; reactions?: Record<string, string> | null; editedAt?: string | null; deletedAt?: string | null;
};

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "👏"] as const;
const EDIT_WINDOW_MS = 15 * 60_000;

export const canEditMessage = (m: RichMsg) =>
  m.direction === "OUTBOUND" && !m.mediaType && !m.deletedAt && Date.now() - new Date(m.sentAt).getTime() <= EDIT_WINDOW_MS;

// ── Reacciones ────────────────────────────────────────────────────────
export function ReactionBadges({ reactions, isOut }: { reactions?: Record<string, string> | null; isOut: boolean }) {
  const list = Object.entries(reactions ?? {}).filter(([, emoji]) => !!emoji);
  if (!list.length) return null;
  return (
    <div className={cn("flex gap-0.5 -mt-1.5 relative z-10", isOut ? "justify-end pr-2" : "justify-start pl-2")}>
      {list.map(([who, emoji]) => (
        <span key={who} title={who === "ME" ? "Tu reacción" : "Reacción del cliente"}
          className="text-[12px] leading-none bg-white border border-border/70 rounded-full px-1.5 py-0.5 shadow-sm">{emoji}</span>
      ))}
    </div>
  );
}

// ── Ubicación y encuesta (renderizado de burbujas) ─────────────────────
type LocMeta = { latitude?: number; longitude?: number; name?: string; address?: string };
type PollMeta = { question?: string; options?: string[] };

export function LocationBubble({ msg, isOut }: { msg: RichMsg; isOut: boolean }) {
  const meta = (msg.meta ?? {}) as LocMeta;
  const hasCoords = typeof meta.latitude === "number" && typeof meta.longitude === "number";
  const href = hasCoords ? `https://www.google.com/maps?q=${meta.latitude},${meta.longitude}` : undefined;
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className={cn("block max-w-[240px] rounded-2xl overflow-hidden border text-[13px]",
        isOut ? "bg-primary text-white border-primary rounded-tr-sm" : "bg-white border-border/60 rounded-tl-sm shadow-sm")}>
      <div className={cn("h-16 flex items-center justify-center", isOut ? "bg-white/15" : "bg-emerald-50")}>
        <MapPin className={cn("h-6 w-6", isOut ? "text-white" : "text-emerald-600")} />
      </div>
      <div className="px-3 py-2">
        <p className="font-semibold leading-snug">{meta.name || "Ubicación"}</p>
        {meta.address && <p className={cn("text-[11.5px] mt-0.5", isOut ? "text-white/80" : "text-muted-foreground")}>{meta.address}</p>}
        {hasCoords && <p className={cn("text-[11px] mt-1 flex items-center gap-1", isOut ? "text-white/90" : "text-primary")}><ExternalLink className="h-3 w-3" /> Abrir en Google Maps</p>}
      </div>
    </a>
  );
}

export function PollBubble({ msg, isOut }: { msg: RichMsg; isOut: boolean }) {
  const meta = (msg.meta ?? {}) as PollMeta;
  return (
    <div className={cn("max-w-[260px] rounded-2xl px-3.5 py-2.5 text-[13px]",
      isOut ? "bg-primary text-white rounded-tr-sm" : "bg-white border border-border/60 rounded-tl-sm shadow-sm")}>
      <p className="flex items-start gap-1.5 font-semibold leading-snug"><BarChart3 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {meta.question ?? msg.content}</p>
      <ul className="mt-1.5 space-y-1">
        {(meta.options ?? []).map((o) => (
          <li key={o} className={cn("rounded-md px-2 py-1 text-[12.5px]", isOut ? "bg-white/15" : "bg-muted")}>{o}</li>
        ))}
      </ul>
    </div>
  );
}

export function DeletedBubble({ isOut }: { isOut: boolean }) {
  return (
    <div className={cn("px-3.5 py-2 rounded-2xl text-[12.5px] italic border",
      isOut ? "border-primary/30 text-muted-foreground bg-muted/40 rounded-tr-sm" : "border-border/60 text-muted-foreground bg-muted/40 rounded-tl-sm")}>
      🚫 Mensaje eliminado
    </div>
  );
}

// ── Menú por mensaje: reaccionar / editar / eliminar ─────────────────────
export function MessageMenu({ msg, isOut, waCapable, onEdit, onError }: {
  msg: RichMsg; isOut: boolean; waCapable: boolean; onEdit: (m: RichMsg) => void; onError: (message: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (msg.deletedAt || !waCapable) return null;

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) onError(r.error); else router.refresh();
  }
  const mine = msg.reactions?.ME;

  return (
    <div className={cn("absolute top-0 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity", isOut ? "-left-7" : "-right-7")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button disabled={busy} title="Acciones del mensaje"
            className="h-6 w-6 rounded-full bg-white border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOut ? "end" : "start"} className="w-auto min-w-[180px]">
          <div className="flex items-center gap-0.5 px-1 py-0.5">
            {QUICK_REACTIONS.map((e) => (
              <DropdownMenuItem key={e} onSelect={() => run(() => reactToMessage(msg.id, mine === e ? "" : e))}
                className={cn("h-8 w-8 p-0 justify-center text-[17px] cursor-pointer", mine === e && "bg-accent")}>{e}</DropdownMenuItem>
            ))}
          </div>
          {(canEditMessage(msg) || isOut) && <DropdownMenuSeparator />}
          {canEditMessage(msg) && (
            <DropdownMenuItem onSelect={() => onEdit(msg)} className="text-xs gap-2 cursor-pointer"><Pencil className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
          )}
          {isOut && (
            <DropdownMenuItem onSelect={() => { if (window.confirm("¿Eliminar este mensaje para todos? El cliente verá “Mensaje eliminado”.")) void run(() => deleteMessageForEveryone(msg.id)); }}
              className="text-xs gap-2 cursor-pointer text-red-600"><Trash2 className="h-3.5 w-3.5" /> Eliminar para todos</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Modales ──────────────────────────────────────────────────────────────
function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[420px] max-w-[92vw] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-[14px] font-bold">{title}</h3>
          <button onClick={onClose} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export type LocatableProperty = { id: string; title: string; hasLocation?: boolean };

export function PropertyLocationModal({ conversationId, properties, onClose }: {
  conversationId: string; properties: LocatableProperty[]; onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const list = useMemo(() => properties.filter((p) => p.title.toLowerCase().includes(q.toLowerCase())), [properties, q]);

  async function send(id: string) {
    setBusyId(id); setError("");
    const r = await sendPropertyLocation(conversationId, id);
    setBusyId(null);
    if (!r.ok) { setError(r.error); return; }
    router.refresh();
    onClose();
  }

  return (
    <Overlay title="Enviar ubicación de una propiedad" onClose={onClose}>
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar propiedad…" autoFocus
            className="w-full h-8 border border-border rounded-lg pl-8 pr-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-1.5">
        {list.length === 0 ? <p className="text-[12.5px] text-muted-foreground p-3">No hay propiedades que coincidan.</p> : list.map((p) => (
          <button key={p.id} disabled={!!busyId || p.hasLocation === false} onClick={() => send(p.id)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent">
            {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <MapPin className={cn("h-4 w-4 shrink-0", p.hasLocation === false ? "text-muted-foreground" : "text-emerald-600")} />}
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-medium truncate">{p.title}</span>
              {p.hasLocation === false && <span className="block text-[11px] text-muted-foreground">Sin coordenadas — agrégalas en el Catálogo</span>}
            </span>
          </button>
        ))}
      </div>
      {error && <p className="text-[12px] text-red-500 px-4 py-2 border-t border-border">{error}</p>}
    </Overlay>
  );
}

export function PollModal({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true); setError("");
    const r = await sendPoll(conversationId, question, options);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    router.refresh();
    onClose();
  }
  const input = "w-full border border-border rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary";

  return (
    <Overlay title="Enviar encuesta" onClose={onClose}>
      <div className="p-4 space-y-3 overflow-y-auto">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Pregunta (ej. ¿Qué horario te conviene para la visita?)" maxLength={200} className={input} autoFocus />
        <div className="space-y-1.5">
          {options.map((o, i) => (
            <div key={i} className="flex gap-1.5">
              <input value={o} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Opción ${i + 1}`} maxLength={100} className={input} />
              {options.length > 2 && (
                <button onClick={() => setOptions((os) => os.filter((_, j) => j !== i))} className="h-8 w-8 shrink-0 rounded-md hover:bg-muted text-muted-foreground flex items-center justify-center"><X className="h-3.5 w-3.5" /></button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button onClick={() => setOptions((os) => [...os, ""])} className="text-[12px] text-primary hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Agregar opción</button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">Las encuestas solo funcionan con WhatsApp personal (Evolution), no con la API oficial.</p>
        {error && <p className="text-[12px] text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} className="h-8 text-xs">Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={busy} className="h-8 text-xs">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enviar encuesta"}</Button>
        </div>
      </div>
    </Overlay>
  );
}
