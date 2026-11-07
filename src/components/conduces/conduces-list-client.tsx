"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createConduceEntrada } from "@/app/actions/conduces";
import { CONDUCE_REASON_LABELS, CONDUCE_STATUS_LABELS, CONDUCE_TYPE_LABELS } from "@/lib/conduces/labels";
import { ModalShell } from "@/components/agentes/action-modals";

type ConduceRow = {
  id: string;
  type: "ENTRADA" | "SALIDA";
  reason: keyof typeof CONDUCE_REASON_LABELS;
  reasonDetail: string | null;
  status: "ABIERTO" | "CERRADO" | "VENCIDO";
  driverName: string | null;
  destinationLocation: string | null;
  mileageAtMovement: number | null;
  documentUrl: string | null;
  expectedReturnAt: string | null;
  actualReturnAt: string | null;
  createdAt: string;
  vehicle: { id: string; make: string; model: string; year: number; vin: string | null };
  authorizedByName: string;
  leadName: string | null;
};

const STATUS_CLS: Record<ConduceRow["status"], string> = {
  ABIERTO: "bg-blue-100 text-blue-700 border-blue-300",
  CERRADO: "bg-green-100 text-green-700 border-green-300",
  VENCIDO: "bg-red-100 text-red-700 border-red-300",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export function ConducesListClient({ conduces }: { conduces: ConduceRow[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"TODOS" | ConduceRow["status"]>("TODOS");
  const [closingId, setClosingId] = useState<string | null>(null);

  const filtered = conduces.filter((c) => statusFilter === "TODOS" || c.status === statusFilter);
  const closing = conduces.find((c) => c.id === closingId) ?? null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Conduces</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Historial de movimientos de vehículos — salidas, entradas y pruebas de manejo.</p>
        </div>

        <div className="flex items-center gap-1.5">
          {(["TODOS", "ABIERTO", "CERRADO", "VENCIDO"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors",
                statusFilter === s ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}>
              {s === "TODOS" ? "Todos" : CONDUCE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <ClipboardList className="h-12 w-12 opacity-20" />
            <p className="text-sm">No hay conduces{statusFilter !== "TODOS" ? ` en estado "${CONDUCE_STATUS_LABELS[statusFilter]}"` : ""}.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 px-4">Vehículo</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Tipo</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Motivo</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Chofer</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Estado</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Fecha</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Documento</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-4">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="py-2.5 px-4">
                      <Link href={`/inventario/${c.vehicle.id}`} className="font-semibold text-primary hover:underline">
                        {c.vehicle.make} {c.vehicle.model} {c.vehicle.year}
                      </Link>
                      {c.leadName && <p className="text-[11px] text-gray-400">{c.leadName}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-700">{CONDUCE_TYPE_LABELS[c.type]}</td>
                    <td className="py-2.5 pr-3 text-gray-500">{CONDUCE_REASON_LABELS[c.reason]}</td>
                    <td className="py-2.5 pr-3 text-gray-500">{c.driverName ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", STATUS_CLS[c.status])}>
                        {CONDUCE_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400">{fmtDate(c.createdAt)}</td>
                    <td className="py-2.5 pr-3">
                      {c.documentUrl ? (
                        <a href={c.documentUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          <FileText className="h-3 w-3" /> PDF
                        </a>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      {c.type === "SALIDA" && c.status === "ABIERTO" && (
                        <button onClick={() => setClosingId(c.id)} className="text-[11.5px] font-medium text-primary hover:underline">
                          Registrar entrada
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {closing && (
        <CloseConduceModal
          conduce={closing}
          onClose={() => setClosingId(null)}
          onSaved={() => { setClosingId(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function CloseConduceModal({ conduce, onClose, onSaved }: {
  conduce: ConduceRow; onClose: () => void; onSaved: () => void;
}) {
  const [mileage, setMileage] = useState("");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await createConduceEntrada(conduce.vehicle.id, {
        returnConduceId: conduce.id,
        mileageAtMovement: mileage ? Number(mileage) : undefined,
        observations: observations || undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la entrada.");
      setSaving(false);
    }
  }

  return (
    <ModalShell icon={ClipboardList} iconColor="text-primary" iconBg="bg-primary/10"
      title="Registrar entrada" subtitle={`${conduce.vehicle.make} ${conduce.vehicle.model} ${conduce.vehicle.year}`} onClose={onClose}
      width={420}
      footer={<>
        <div />
        <div className="flex gap-2">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {saving ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </>}>
      <div className="p-5 space-y-3">
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">Kilometraje al regresar</label>
          <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
        </div>
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">Observaciones</label>
          <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary resize-none" />
        </div>
        {error && <p className="text-[11.5px] text-red-500">{error}</p>}
      </div>
    </ModalShell>
  );
}
