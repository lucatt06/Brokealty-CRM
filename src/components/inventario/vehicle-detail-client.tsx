"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Car, Gauge, Fuel, MapPin, FileDown, AlertTriangle,
  LogOut, LogIn, X, Loader2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_CFG, TRANS_LABEL, FUEL_LABEL, BODY_LABEL, vehicleTitle, primaryPhoto,
} from "@/components/inventario/inventario-client";
import { CollapsibleSection, Field } from "@/components/conversaciones/conversaciones-client";
import { CONDUCE_REASON_LABELS, CONDUCE_STATUS_LABELS, CONDUCE_TYPE_LABELS } from "@/lib/conduces/labels";
import { createConduceSalida, createConduceEntrada } from "@/app/actions/conduces";
import type { ConduceReason } from "@prisma/client";

type Photo = { id: string; url: string; isPrimary: boolean; order: number };
type VTag = { id: string; name: string; color: string };
type Conduce = {
  id: string;
  type: "ENTRADA" | "SALIDA";
  reason: ConduceReason;
  reasonDetail: string | null;
  status: "ABIERTO" | "CERRADO" | "VENCIDO";
  driverName: string | null;
  driverDocument: string | null;
  destinationLocation: string | null;
  originLocation: string | null;
  mileageAtMovement: number | null;
  observations: string | null;
  expectedReturnAt: string | null;
  actualReturnAt: string | null;
  documentUrl: string | null;
  createdAt: string;
  authorizedBy: { id: string; name: string };
  lead: { id: string; firstName: string; lastName: string | null } | null;
};

type Vehicle = {
  id: string; status: keyof typeof STATUS_CFG;
  make: string; model: string; year: number; trim: string | null;
  color: string | null; vin: string | null; mileage: number | null;
  transmission: keyof typeof TRANS_LABEL; fuelType: keyof typeof FUEL_LABEL;
  bodyType: keyof typeof BODY_LABEL | null; engineCC: number | null; doors: number | null;
  priceDOP: number | null; priceUSD: number | null;
  lotLocation: string | null; daysInLot: number;
  description: string | null; features: string[];
  photos: Photo[]; tags: VTag[]; conduces: Conduce[];
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const REASON_OPTIONS: ConduceReason[] = [
  "PRUEBA_MANEJO", "TRASLADO_TALLER", "TRASLADO_SUCURSAL", "INGRESO_LOTE", "OTRO",
];

export function VehicleDetailClient({ vehicle, canManageConduces }: { vehicle: Vehicle; canManageConduces: boolean }) {
  const router = useRouter();
  const [modal, setModal] = useState<"salida" | "entrada" | null>(null);

  const photo = primaryPhoto(vehicle.photos);
  const openSalidas = vehicle.conduces.filter((c) => c.type === "SALIDA" && c.status === "ABIERTO");
  const overdue = vehicle.conduces.find((c) => c.status === "VENCIDO");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-12 flex items-center gap-3 border-b border-border bg-card px-3 shrink-0">
        <button onClick={() => router.push("/inventario")} title="Volver a Inventario"
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-[14px] font-semibold text-foreground truncate">{vehicleTitle(vehicle)}</h1>
        <Badge className={cn("text-[11px] border font-medium shrink-0", STATUS_CFG[vehicle.status].bg, STATUS_CFG[vehicle.status].color, STATUS_CFG[vehicle.status].border)}>
          {STATUS_CFG[vehicle.status].label}
        </Badge>
        {overdue && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-100 border border-purple-300 rounded-full px-2 py-0.5 shrink-0">
            <AlertTriangle className="h-3 w-3" /> Conduce vencido
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Columna 1: resumen del vehículo */}
        <div className="w-[320px] shrink-0 border-r border-border bg-white overflow-y-auto">
          <div className="aspect-[4/3] bg-gray-100">
            {photo ? (
              <img src={photo.url} alt={vehicleTitle(vehicle)} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Car className="h-10 w-10 text-gray-200" />
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><Gauge className="h-3 w-3" /> {(vehicle.mileage ?? 0).toLocaleString("es-DO")} km</span>
            <span className="flex items-center gap-1"><Fuel className="h-3 w-3" /> {FUEL_LABEL[vehicle.fuelType]}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {vehicle.lotLocation || "Sin ubicación"}</span>
          </div>

          <CollapsibleSection title="Precios" open onToggle={() => {}}>
            <Field label="Precio (DOP)" value={vehicle.priceDOP != null ? formatCurrency(vehicle.priceDOP, "DOP") : "—"} />
            {vehicle.priceUSD != null && <Field label="Precio (USD)" value={formatCurrency(vehicle.priceUSD, "USD")} />}
          </CollapsibleSection>

          <CollapsibleSection title="Especificaciones" open onToggle={() => {}}>
            {vehicle.trim && <Field label="Versión" value={vehicle.trim} />}
            {vehicle.color && <Field label="Color" value={vehicle.color} />}
            <Field label="Transmisión" value={TRANS_LABEL[vehicle.transmission]} />
            {vehicle.bodyType && <Field label="Carrocería" value={BODY_LABEL[vehicle.bodyType]} />}
            {vehicle.engineCC != null && <Field label="Motor" value={`${vehicle.engineCC} cc`} />}
            {vehicle.doors != null && <Field label="Puertas" value={String(vehicle.doors)} />}
            {vehicle.vin && <Field label="VIN" value={vehicle.vin} />}
          </CollapsibleSection>

          {vehicle.tags.length > 0 && (
            <div className="px-4 py-3 flex flex-wrap gap-1">
              {vehicle.tags.map((t) => (
                <span key={t.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${t.color}18`, color: t.color }}>
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Columna 2: Conduces */}
        <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Conduces</h2>
            {canManageConduces && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setModal("salida")} className="h-8 text-xs">
                  <LogOut className="h-3.5 w-3.5 mr-1.5" /> Registrar salida
                </Button>
                <Button size="sm" variant="outline" disabled={!openSalidas.length} onClick={() => setModal("entrada")} className="h-8 text-xs">
                  <LogIn className="h-3.5 w-3.5 mr-1.5" /> Registrar entrada
                </Button>
              </div>
            )}
          </div>

          {vehicle.conduces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Car className="h-10 w-10 opacity-15" />
              <p className="text-[13px]">Sin movimientos registrados para este vehículo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vehicle.conduces.map((c) => (
                <ConduceRow key={c.id} conduce={c} />
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {modal === "salida" && (
          <ConduceSalidaModal vehicleId={vehicle.id} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />
        )}
        {modal === "entrada" && (
          <ConduceEntradaModal vehicleId={vehicle.id} openSalidas={openSalidas} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ConduceRow({ conduce }: { conduce: Conduce }) {
  const statusCls = conduce.status === "ABIERTO"
    ? "bg-blue-100 text-blue-700 border-blue-300"
    : conduce.status === "VENCIDO"
    ? "bg-purple-100 text-purple-700 border-purple-300"
    : "bg-gray-100 text-gray-600 border-gray-300";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              conduce.type === "SALIDA" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-green-50 text-green-700 border-green-200")}>
              {CONDUCE_TYPE_LABELS[conduce.type]}
            </span>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", statusCls)}>
              {CONDUCE_STATUS_LABELS[conduce.status]}
            </span>
          </div>
          <p className="text-[13px] font-semibold text-gray-900">
            {CONDUCE_REASON_LABELS[conduce.reason]}
            {conduce.reasonDetail ? ` — ${conduce.reasonDetail}` : ""}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Autorizado por {conduce.authorizedBy.name} · {fmtDate(conduce.createdAt)}
          </p>
          {conduce.driverName && (
            <p className="text-[11px] text-gray-500">Chofer: {conduce.driverName}{conduce.driverDocument ? ` (${conduce.driverDocument})` : ""}</p>
          )}
          {(conduce.destinationLocation || conduce.originLocation) && (
            <p className="text-[11px] text-gray-500">{conduce.originLocation ? `${conduce.originLocation} → ` : ""}{conduce.destinationLocation}</p>
          )}
          {conduce.expectedReturnAt && (
            <p className="text-[11px] text-gray-500">Retorno esperado: {fmtDate(conduce.expectedReturnAt)}</p>
          )}
          {conduce.actualReturnAt && (
            <p className="text-[11px] text-gray-500">Retorno real: {fmtDate(conduce.actualReturnAt)}</p>
          )}
          {conduce.lead && (
            <p className="text-[11px] text-gray-500">Lead: {conduce.lead.firstName} {conduce.lead.lastName ?? ""}</p>
          )}
        </div>
        {conduce.documentUrl && (
          <a href={conduce.documentUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0">
            <FileDown className="h-3.5 w-3.5" /> PDF
          </a>
        )}
      </div>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-[420px] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function ConduceSalidaModal({ vehicleId, onClose, onDone }: { vehicleId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<ConduceReason>("PRUEBA_MANEJO");
  const [reasonDetail, setReasonDetail] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverDocument, setDriverDocument] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [mileage, setMileage] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await createConduceSalida(vehicleId, {
        reason,
        reasonDetail: reasonDetail || undefined,
        driverName: driverName || undefined,
        driverDocument: driverDocument || undefined,
        destinationLocation: destinationLocation || undefined,
        mileageAtMovement: mileage ? Number(mileage) : undefined,
        expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt).toISOString() : undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error al registrar la salida.");
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Registrar salida" onClose={onClose}>
      <div>
        <label className="text-[11px] text-muted-foreground">Motivo</label>
        <select value={reason} onChange={(e) => setReason(e.target.value as ConduceReason)}
          className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary">
          {REASON_OPTIONS.map((r) => <option key={r} value={r}>{CONDUCE_REASON_LABELS[r]}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Detalle (opcional)</label>
        <input value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)}
          className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">Chofer / responsable</label>
          <input value={driverName} onChange={(e) => setDriverName(e.target.value)}
            className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Cédula</label>
          <input value={driverDocument} onChange={(e) => setDriverDocument(e.target.value)}
            className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Destino</label>
        <input value={destinationLocation} onChange={(e) => setDestinationLocation(e.target.value)}
          className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">Kilometraje</label>
          <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)}
            className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Retorno esperado</label>
          <input type="datetime-local" value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)}
            className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={handleSubmit} disabled={saving} className="w-full h-9 text-sm">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar salida"}
      </Button>
    </ModalShell>
  );
}

function ConduceEntradaModal({ vehicleId, openSalidas, onClose, onDone }: {
  vehicleId: string; openSalidas: Conduce[]; onClose: () => void; onDone: () => void;
}) {
  const [returnConduceId, setReturnConduceId] = useState(openSalidas[0]?.id ?? "");
  const [mileage, setMileage] = useState("");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!returnConduceId) return;
    setSaving(true);
    setError(null);
    try {
      await createConduceEntrada(vehicleId, {
        returnConduceId,
        mileageAtMovement: mileage ? Number(mileage) : undefined,
        observations: observations || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error al registrar la entrada.");
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Registrar entrada" onClose={onClose}>
      <div>
        <label className="text-[11px] text-muted-foreground">Salida que retorna</label>
        <select value={returnConduceId} onChange={(e) => setReturnConduceId(e.target.value)}
          className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary">
          {openSalidas.map((s) => (
            <option key={s.id} value={s.id}>
              {CONDUCE_REASON_LABELS[s.reason]} · {fmtDate(s.createdAt)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Kilometraje</label>
        <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)}
          className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Observaciones</label>
        <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3}
          className="w-full mt-1 text-sm border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary resize-none" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={handleSubmit} disabled={saving || !returnConduceId} className="w-full h-9 text-sm">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar entrada"}
      </Button>
    </ModalShell>
  );
}
