"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, CornerDownLeft, Check, Loader2 } from "lucide-react";
import { askBro, getBroHistory, type BroEntry } from "@/app/actions/bro";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Resúmeme a este cliente",
  "¿Cuál es el siguiente paso?",
  "Redáctale un seguimiento",
  "Busca propiedades que le encajen",
];

export function BroPanel({ leadId, conversationId, leadName, onUseDraft, onActed }: {
  leadId: string;
  conversationId: string | null;
  leadName: string;
  onUseDraft: (text: string) => void;
  onActed: () => void;
}) {
  // La memoria vive en el servidor (una sesión por contacto y usuario); aquí solo se muestra.
  const [entries, setEntries] = useState<BroEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null); // mensaje en vuelo, se muestra al instante
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef(leadId);

  useEffect(() => {
    leadRef.current = leadId;
    setEntries([]); setPending(null); setError(null); setLoading(true);
    getBroHistory(leadId)
      .then((r) => { if (leadRef.current === leadId && r.ok) setEntries(r.entries); })
      .catch(() => {})
      .finally(() => { if (leadRef.current === leadId) setLoading(false); });
  }, [leadId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [entries, busy, pending, loading]);

  // Con la charla en marcha el panel sube a la mitad de la altura de la pantalla.
  const expanded = entries.length > 0 || pending !== null;

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput(""); setBusy(true); setPending(msg); setError(null);
    const lead = leadId;
    try {
      const r = await askBro(lead, conversationId, msg);
      if (leadRef.current !== lead) return;
      if (r.ok) {
        const hadActions = r.entries.at(-1)?.actions.length;
        setEntries(r.entries);
        if (hadActions) onActed();
      } else {
        setError(r.error); setInput(msg);
      }
    } catch {
      if (leadRef.current === lead) { setError("No pude conectar con Bro. Inténtalo de nuevo."); setInput(msg); }
    } finally {
      if (leadRef.current === lead) { setPending(null); setBusy(false); }
    }
  }

  return (
    <div className="flex flex-col">
      <div
        className="overflow-y-auto px-3 py-2 space-y-2 transition-[height] duration-300 ease-out"
        // Antes del primer mensaje: compacto. Después: el compositor entero ocupa ~la mitad de la pantalla.
        style={{ height: expanded ? "calc(50vh - 120px)" : "7.5rem" }}
      >
        {loading && <div className="flex items-center gap-1.5 text-[12px] text-violet-600"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Recuperando tu charla con Bro…</div>}
        {!loading && !expanded && (
          <div className="py-1">
            <p className="text-[12px] text-muted-foreground mb-2">
              Soy <span className="font-semibold text-violet-700">Bro</span>. Ya conozco a <span className="font-medium text-foreground">{leadName}</span>: sus conversaciones, notas, tareas, citas y todo su historial. Pídeme lo que necesites.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-[11px] rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700 hover:bg-violet-100 transition-colors">{s}</button>
              ))}
            </div>
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className={cn("flex", e.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
              e.role === "user" ? "bg-violet-600 text-white" : "bg-violet-50 text-foreground border border-violet-100")}>
              {e.content}
              {e.actions.map((a, j) => (
                <div key={j} className="mt-1.5 flex items-start gap-1.5 text-[11px] text-emerald-700"><Check className="h-3 w-3 mt-0.5 shrink-0" />{a}</div>
              ))}
              {e.drafts.map((d, j) => (
                <div key={j} className="mt-2 rounded-lg border border-violet-200 bg-white p-2">
                  <p className="text-[12px] text-foreground whitespace-pre-wrap">{d}</p>
                  <button onClick={() => onUseDraft(d)} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 hover:text-violet-900">
                    <CornerDownLeft className="h-3 w-3" /> Usar como mensaje
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-end">
            <div className="max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap bg-violet-600 text-white">{pending}</div>
          </div>
        )}
        {busy && (
          <div className="flex items-center gap-1.5 text-[12px] text-violet-600"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Bro está pensando…</div>
        )}
        {error && <div className="rounded-xl px-3 py-2 text-[12px] bg-red-50 text-red-700 border border-red-200">{error}</div>}
        <div ref={endRef} />
      </div>
      <div className="flex items-end gap-2 px-3 pb-2 pt-1 border-t border-border/50">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder={`Pídele algo a Bro sobre ${leadName}…`}
          rows={2}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 py-1.5"
        />
        <button onClick={() => send(input)} disabled={!input.trim() || busy}
          className="h-8 px-3 rounded-md bg-violet-600 text-white text-sm inline-flex items-center gap-1 hover:bg-violet-700 disabled:opacity-50 transition-colors">
          <Send className="h-3.5 w-3.5" /> Enviar
        </button>
      </div>
    </div>
  );
}

export const BroIcon = Sparkles;
