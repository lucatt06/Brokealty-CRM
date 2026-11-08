"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateLeadName } from "@/app/actions/leads";

/** Nombre del contacto con edición en línea. Si aún es el teléfono, invita a ponerle nombre. */
export function EditableName({ leadId, firstName, lastName, phone, className }: {
  leadId: string; firstName: string; lastName: string | null; phone: string; className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const full = `${firstName} ${lastName ?? ""}`.trim();
  const isPlaceholder = !lastName && (firstName.trim() === phone || /^[+\d\s().-]{6,}$/.test(firstName.trim()));

  function open() { setFirst(isPlaceholder ? "" : firstName); setLast(lastName ?? ""); setError(""); setEditing(true); }

  async function save() {
    setBusy(true); setError("");
    const r = await updateLeadName(leadId, first, last || null);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className={cn("flex items-center gap-1.5 min-w-0", className)}>
        <p className="font-semibold text-[13px] truncate">{full}</p>
        <button onClick={open} title="Editar nombre" className="text-muted-foreground hover:text-primary shrink-0"><Pencil className="h-3 w-3" /></button>
        {isPlaceholder && (
          <button onClick={open} className="text-[10.5px] text-primary hover:underline shrink-0">Agregar nombre</button>
        )}
      </div>
    );
  }

  const input = "w-full border border-border rounded-md px-2 py-1 text-[12.5px] outline-none focus:ring-1 focus:ring-primary";
  return (
    <div className="space-y-1.5 w-full">
      <div className="grid grid-cols-2 gap-1.5">
        <div><label className="text-[10px] text-muted-foreground">Nombre</label>
          <input value={first} onChange={(e) => setFirst(e.target.value)} autoFocus maxLength={80} className={input}
            onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }} /></div>
        <div><label className="text-[10px] text-muted-foreground">Apellido</label>
          <input value={last} onChange={(e) => setLast(e.target.value)} maxLength={80} className={input}
            onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }} /></div>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      <div className="flex gap-1.5">
        <button onClick={save} disabled={busy || !first.trim()} className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-md bg-primary text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Guardar
        </button>
        <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-md hover:bg-muted"><X className="h-3 w-3" /> Cancelar</button>
      </div>
    </div>
  );
}
