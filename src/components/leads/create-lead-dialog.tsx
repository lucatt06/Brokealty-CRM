"use client";

import { LISTING_TYPES, LISTING_TYPE_LABELS, PROPERTY_TYPES, PROPERTY_TYPE_LABELS } from "@/lib/properties/labels";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type User = { id: string; name: string };

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: User[];
  workspaceId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (lead: any) => void;
}

const SOURCES = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "WEB", label: "Web" },
  { value: "REFERIDO", label: "Referido" },
  { value: "LLAMADA", label: "Llamada" },
  { value: "EMAIL", label: "Email" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "MANUAL", label: "Manual" },
];

export function CreateLeadDialog({ open, onOpenChange, users, onCreated }: CreateLeadDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", email: "",
    source: "MANUAL", assignedTo: "", desiredPropertyType: "", desiredListingType: "", desiredCity: "", desiredSector: "", desiredBedrooms: "",
    budgetMin: "", budgetMax: "", budgetCurrency: "USD", notes: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, assignedTo: form.assignedTo || null }),
    });
    const lead = await res.json();
    setLoading(false);
    setForm({ firstName: "", lastName: "", phone: "", email: "", source: "MANUAL", assignedTo: "", desiredPropertyType: "", desiredListingType: "", desiredCity: "", desiredSector: "", desiredBedrooms: "", budgetMin: "", budgetMax: "", budgetCurrency: "USD", notes: "" });
    onCreated(lead);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Nombre */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Juan" required className="h-8" />
            </div>
            <div className="space-y-1.5">
              <Label>Apellido</Label>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Pérez" className="h-8" />
            </div>
          </div>

          {/* Contacto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Teléfono *</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="809-000-0000" required className="h-8" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@ejemplo.com" className="h-8" />
            </div>
          </div>

          {/* Fuente + Asignado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fuente</Label>
              <Select value={form.source} onValueChange={(v) => set("source", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Asignar a</Label>
              <Select value={form.assignedTo} onValueChange={(v) => set("assignedTo", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Interés */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de propiedad</Label>
              <select value={form.desiredPropertyType} onChange={(e) => set("desiredPropertyType", e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">—</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Busca para</Label>
              <select value={form.desiredListingType} onChange={(e) => set("desiredListingType", e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">—</option>
                {LISTING_TYPES.map((t) => <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Input value={form.desiredCity} onChange={(e) => set("desiredCity", e.target.value)} placeholder="Santo Domingo" className="h-8" />
            </div>
            <div className="space-y-1.5">
              <Label>Sector / zona</Label>
              <Input value={form.desiredSector} onChange={(e) => set("desiredSector", e.target.value)} placeholder="Naco, Piantini…" className="h-8" />
            </div>
            <div className="space-y-1.5">
              <Label>Habitaciones (mínimo)</Label>
              <Input type="number" min={0} value={form.desiredBedrooms} onChange={(e) => set("desiredBedrooms", e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda del presupuesto</Label>
              <select value={form.budgetCurrency} onChange={(e) => set("budgetCurrency", e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="USD">US$</option>
                <option value="DOP">RD$</option>
              </select>
            </div>
          </div>

          {/* Presupuesto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Presupuesto mín. ({form.budgetCurrency === "USD" ? "US$" : "RD$"})</Label>
              <Input type="number" value={form.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} placeholder="500,000" className="h-8" />
            </div>
            <div className="space-y-1.5">
              <Label>Presupuesto máx. ({form.budgetCurrency === "USD" ? "US$" : "RD$"})</Label>
              <Input type="number" value={form.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} placeholder="1,000,000" className="h-8" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
