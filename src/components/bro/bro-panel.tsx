"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, CornerDownLeft, Check, Loader2 } from "lucide-react";
import { askBro, type BroTurn } from "@/app/actions/bro";
import { cn } from "@/lib/utils";

type Entry = { role: "user" | "assistant"; content: string; drafts?: string[]; actions?: string[]; error?: boolean };

// Las conversaciones con Bro viven en el navegador mientras la pestaña esté abierta (una por contacto).
const memory = new Map<string, Entry[]>();

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
  const [entries, setEntries] = useState<Entry[]>(() => memory.get(leadId) ?? []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setEntries(memory.get(leadId) ?? []); }, [leadId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [entries, busy]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    const history: BroTurn[] = entries.filter((e) => !e.error).map((e) => ({ role: e.role, content: e.content }));
    const next: Entry[] = [...entries, { role: "user", content: msg }];
    setEntries(next); memory.set(leadId, next);
    setInput(""); setBusy(true);
    try {
      const r = await askBro(leadId, conversationId, history, msg);
      const reply: Entry = r.ok
        ? { role: "assistant", content: r.reply, drafts: r.drafts, actions: r.actions }
        : { role: "assistant", content: r.error, error: true };
      const done = [...next, reply];
      setEntries(done); memory.set(leadId, done);
      if (r.ok && r.actions.length) onActed();
    } catch {
      const done: Entry[] = [...next, { role: "assistant", content: "No pude conectar con Bro. Inténtalo de nuevo.", error: true }];
      setEntries(done); memory.set(leadId, done);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-64 min-h-[7rem] overflow-y-auto px-3 py-2 space-y-2">
        {entries.length === 0 && (
          <div className="py-1">
            <p className="text-[12px] text-muted-foreground mb-2">
              Soy <span className="font-semibold text-violet-700">Bro</span>. Ya tengo la ficha y la conversación de <span className="font-medium text-foreground">{leadName}</span>; pídeme lo que necesites.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-[11px] rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700 hover:bg-violet-100 transition-colors">{s}</button>
              ))}
            </div>
          </div>
        )}
        {entries.map((e, i) => (
          <div key={i} className={cn("flex", e.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
              e.role === "user" ? "bg-violet-600 text-white" : e.error ? "bg-red-50 text-red-700 border border-red-200" : "bg-violet-50 text-foreground border border-violet-100")}>
              {e.content}
              {e.actions?.map((a, j) => (
                <div key={j} className="mt-1.5 flex items-start gap-1.5 text-[11px] text-emerald-700"><Check className="h-3 w-3 mt-0.5 shrink-0" />{a}</div>
              ))}
              {e.drafts?.map((d, j) => (
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
        {busy && (
          <div className="flex items-center gap-1.5 text-[12px] text-violet-600"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Bro está pensando…</div>
        )}
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
