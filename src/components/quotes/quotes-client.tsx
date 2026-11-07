"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, FileText, X, Car, FileDown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createQuote, sendQuote, acceptQuote, rejectQuote, convertQuoteToSalesOrder } from "@/app/actions/quotes";
import type { SalesPaymentMethod } from "@prisma/client";

type Lead = { id: string; firstName: string; lastName: string | null; phone: string };
type Vehicle = { id: string; make: string; model: string; year: number; priceDOP: number | null };
type Quote = {
  id: string; quoteNumber: string; offeredPrice: number; currency: string;
  status: "BORRADOR" | "ENVIADA" | "ACEPTADA" | "RECHAZADA" | "EXPIRADA" | "CONVERTIDA";
  validUntil: string; documentUrl: string | null; createdAt: string;
  lead: { id: string; firstName: string; lastName: string | null };
  vehicle: { id: string; make: string; model: string; year: number };
};

const STATUS_CFG: Record<Quote["status"], { label: string; cls: string }> = {
  BORRADOR: { label: "Borrador", cls: "bg-gray-100 text-gray-600 border-gray-300" },
  ENVIADA: { label: "Enviada", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  ACEPTADA: { label: "Aceptada", cls: "bg-green-100 text-green-700 border-green-300" },
  RECHAZADA: { label: "Rechazada", cls: "bg-red-100 text-red-700 border-red-300" },
  EXPIRADA: { label: "Expirada", cls: "bg-gray-100 text-gray-500 border-gray-300" },
  CONVERTIDA: { label: "Convertida", cls: "bg-violet-100 text-violet-700 border-violet-300" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export function QuotesClient({ quotes, leads, vehicles, dealsByLead, workspaceId }: {
  quotes: Quote[]; leads: Lead[]; vehicles: Vehicle[]; dealsByLead: { id: string; leadId: string }[]; workspaceId: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  function dealIdFor(leadId: string) {
    return dealsByLead.find((d) => d.leadId === leadId)?.id;
  }

  async function handleConvert(quote: Quote) {
    const dealId = dealIdFor(quote.lead.id);
    if (!dealId) { alert("Este lead no tiene un negocio abierto — crea uno primero desde Negocios."); return; }
    setBusy(quote.id);
    const { salesOrderId } = await convertQuoteToSalesOrder(quote.id, dealId);
    setBusy(null);
    router.push(`/ordenes-venta/${salesOrderId}`);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cotizaciones</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Propuestas formales de precio antes de comprometerse a una venta.</p>
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Nueva cotización</Button>
        </div>

        {quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <FileText className="h-12 w-12 opacity-20" />
            <p className="text-sm">Aún no hay cotizaciones.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 px-4">Cotización</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Cliente</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Vehículo</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Precio</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Válida hasta</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Estado</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="py-2.5 px-4 font-semibold text-gray-900">{q.quoteNumber}</td>
                    <td className="py-2.5 pr-3 text-gray-700">{q.lead.firstName} {q.lead.lastName ?? ""}</td>
                    <td className="py-2.5 pr-3 text-gray-500">{q.vehicle.make} {q.vehicle.model} {q.vehicle.year}</td>
                    <td className="py-2.5 pr-3 font-semibold text-gray-800">{formatCurrency(q.offeredPrice, q.currency === "USD" ? "USD" : "DOP")}</td>
                    <td className="py-2.5 pr-3 text-gray-500">{fmtDate(q.validUntil)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", STATUS_CFG[q.status].cls)}>{STATUS_CFG[q.status].label}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        {q.documentUrl && <a href={q.documentUrl} target="_blank" rel="noreferrer" className="text-primary"><FileDown className="h-3.5 w-3.5" /></a>}
                        {q.status === "BORRADOR" && (
                          <button disabled={busy === q.id} onClick={async () => { setBusy(q.id); await sendQuote(q.id); setBusy(null); router.refresh(); }} className="text-[11px] text-primary hover:underline">Enviar</button>
                        )}
                        {q.status === "ENVIADA" && (
                          <>
                            <button disabled={busy === q.id} onClick={async () => { setBusy(q.id); await acceptQuote(q.id); setBusy(null); router.refresh(); }} className="text-[11px] text-green-700 hover:underline">Aceptar</button>
                            <button disabled={busy === q.id} onClick={async () => { setBusy(q.id); await rejectQuote(q.id); setBusy(null); router.refresh(); }} className="text-[11px] text-destructive hover:underline">Rechazar</button>
                          </>
                        )}
                        {q.status === "ACEPTADA" && (
                          <button disabled={busy === q.id} onClick={() => handleConvert(q)} className="text-[11px] font-medium text-violet-700 hover:underline">Convertir a Orden</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && <NewQuoteModal workspaceId={workspaceId} leads={leads} vehicles={vehicles} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); router.refresh(); }} />}
      </AnimatePresence>
    </div>
  );
}

function NewQuoteModal({ workspaceId, leads, vehicles, onClose, onCreated }: {
  workspaceId: string; leads: Lead[]; vehicles: Vehicle[]; onClose: () => void; onCreated: () => void;
}) {
  const [leadId, setLeadId] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [offeredPrice, setOfferedPrice] = useState("");
  const [currency, setCurrency] = useState("DOP");
  const [paymentMethod, setPaymentMethod] = useState<SalesPaymentMethod>("CONTADO");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);

  const selectedLead = leads.find((l) => l.id === leadId);
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const filteredLeads = leads.filter((l) => `${l.firstName} ${l.lastName ?? ""} ${l.phone}`.toLowerCase().includes(leadSearch.toLowerCase())).slice(0, 8);
  const filteredVehicles = vehicles.filter((v) => `${v.make} ${v.model} ${v.year}`.toLowerCase().includes(vehicleSearch.toLowerCase())).slice(0, 8);

  async function handleCreate() {
    if (!leadId || !vehicleId || !offeredPrice || !validUntil) return;
    setSaving(true);
    await createQuote(workspaceId, {
      leadId, vehicleId, offeredPrice: Number(offeredPrice), currency, paymentMethod, validUntil: new Date(validUntil).toISOString(),
    });
    setSaving(false);
    onCreated();
  }

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-[460px] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Nueva cotización</h3>
          <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground">Cliente</label>
            {selectedLead ? (
              <div className="flex items-center gap-2 border border-border rounded-md px-2.5 py-1.5 mt-1">
                <span className="text-sm flex-1">{selectedLead.firstName} {selectedLead.lastName ?? ""}</span>
                <button onClick={() => setLeadId("")} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="relative">
                <input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Buscar cliente…" className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
                {leadSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg z-10 max-h-[160px] overflow-y-auto">
                    {filteredLeads.map((l) => (
                      <button key={l.id} onClick={() => { setLeadId(l.id); setLeadSearch(""); }} className="w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-muted">
                        {l.firstName} {l.lastName ?? ""} · {l.phone}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Vehículo</label>
            {selectedVehicle ? (
              <div className="flex items-center gap-2 border border-border rounded-md px-2.5 py-1.5 mt-1">
                <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1">{selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.year}</span>
                <button onClick={() => { setVehicleId(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="relative">
                <input value={vehicleSearch} onChange={(e) => setVehicleSearch(e.target.value)} placeholder="Buscar vehículo…" className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
                {vehicleSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg z-10 max-h-[160px] overflow-y-auto">
                    {filteredVehicles.map((v) => (
                      <button key={v.id} onClick={() => { setVehicleId(v.id); if (v.priceDOP) setOfferedPrice(String(v.priceDOP)); setVehicleSearch(""); }} className="w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-muted">
                        {v.make} {v.model} {v.year} {v.priceDOP ? `· ${v.priceDOP.toLocaleString()} DOP` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground">Precio ofrecido</label>
              <div className="flex gap-1.5 mt-1">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="border border-border rounded-md px-1.5 text-[11px] bg-white w-16">
                  <option value="DOP">DOP</option><option value="USD">USD</option>
                </select>
                <input type="number" value={offeredPrice} onChange={(e) => setOfferedPrice(e.target.value)} className="flex-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary min-w-0" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Válida hasta</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Forma de pago</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as SalesPaymentMethod)} className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 bg-white">
              <option value="CONTADO">Contado</option><option value="FINANCIAMIENTO_BANCARIO">Financiamiento bancario</option><option value="MIXTO">Mixto</option><option value="OTRO">Otro</option>
            </select>
          </div>
          <Button onClick={handleCreate} disabled={saving || !leadId || !vehicleId || !offeredPrice} className="w-full h-9 text-sm">
            {saving ? "Creando…" : "Crear cotización"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
