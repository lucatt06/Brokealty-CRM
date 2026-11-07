"use client";

import { useState } from "react";
import Link from "next/link";
import { UserCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { approveDdc, rejectDdc } from "@/app/actions/due-diligence";
import { ModalShell } from "@/components/agentes/action-modals";

type DdcRow = {
  id: string;
  idDocumentType: "CEDULA" | "PASAPORTE" | "RNC" | "OTRO";
  idDocumentNumber: string;
  fullLegalName: string;
  isPep: boolean;
  riskLevel: "BAJO" | "MEDIO" | "ALTO" | null;
  status: "PENDIENTE" | "EN_REVISION" | "APROBADO" | "RECHAZADO";
  rejectionReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  lead: { id: string; firstName: string; lastName: string | null; phone: string };
};

const STATUS_CLS: Record<DdcRow["status"], string> = {
  PENDIENTE: "bg-gray-100 text-gray-600 border-gray-300",
  EN_REVISION: "bg-amber-100 text-amber-700 border-amber-300",
  APROBADO: "bg-green-100 text-green-700 border-green-300",
  RECHAZADO: "bg-red-100 text-red-700 border-red-300",
};
const STATUS_LABEL: Record<DdcRow["status"], string> = {
  PENDIENTE: "Pendiente", EN_REVISION: "En revisión", APROBADO: "Aprobado", RECHAZADO: "Rechazado",
};
const RISK_CLS: Record<NonNullable<DdcRow["riskLevel"]>, string> = {
  BAJO: "bg-green-100 text-green-700 border-green-300",
  MEDIO: "bg-amber-100 text-amber-700 border-amber-300",
  ALTO: "bg-red-100 text-red-700 border-red-300",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export function DdcListClient({ records, isAdmin }: { records: DdcRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"TODOS" | DdcRow["status"]>("TODOS");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const filtered = records.filter((d) => statusFilter === "TODOS" || d.status === statusFilter);
  const reviewing = records.find((d) => d.id === reviewingId) ?? null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Debida Diligencia</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Verificación de identidad y evaluación de riesgo de clientes antes de completar una venta.</p>
        </div>

        <div className="flex items-center gap-1.5">
          {(["TODOS", "PENDIENTE", "EN_REVISION", "APROBADO", "RECHAZADO"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors",
                statusFilter === s ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}>
              {s === "TODOS" ? "Todos" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <UserCheck className="h-12 w-12 opacity-20" />
            <p className="text-sm">No hay registros de Debida Diligencia{statusFilter !== "TODOS" ? ` en estado "${STATUS_LABEL[statusFilter]}"` : ""}.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 px-4">Cliente</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Documento</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Riesgo</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Estado</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Fecha</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-4">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="py-2.5 px-4">
                      <Link href={`/leads/${d.lead.id}`} className="font-semibold text-primary hover:underline">
                        {d.fullLegalName || `${d.lead.firstName} ${d.lead.lastName ?? ""}`}
                      </Link>
                      {d.isPep && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600"><ShieldAlert className="h-3 w-3" /> PEP</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-500">{d.idDocumentType} · {d.idDocumentNumber}</td>
                    <td className="py-2.5 pr-3">
                      {d.riskLevel ? (
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", RISK_CLS[d.riskLevel])}>{d.riskLevel}</span>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", STATUS_CLS[d.status])}>{STATUS_LABEL[d.status]}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400">{fmtDate(d.createdAt)}</td>
                    <td className="py-2.5 pr-4">
                      {isAdmin && (d.status === "PENDIENTE" || d.status === "EN_REVISION") && (
                        <button onClick={() => setReviewingId(d.id)} className="text-[11.5px] font-medium text-primary hover:underline">
                          Revisar
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

      {reviewing && (
        <ReviewModal record={reviewing} onClose={() => setReviewingId(null)} onSaved={() => { setReviewingId(null); router.refresh(); }} />
      )}
    </div>
  );
}

function ReviewModal({ record, onClose, onSaved }: { record: DdcRow; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove() {
    setSaving(true);
    setError("");
    try {
      await approveDdc(record.id, notes || undefined);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aprobar.");
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!notes.trim()) { setError("El rechazo requiere un motivo."); return; }
    setSaving(true);
    setError("");
    try {
      await rejectDdc(record.id, notes);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo rechazar.");
      setSaving(false);
    }
  }

  return (
    <ModalShell icon={UserCheck} iconColor="text-primary" iconBg="bg-primary/10"
      title="Revisar Debida Diligencia" subtitle={record.fullLegalName} onClose={onClose}
      width={460}
      footer={<>
        <button onClick={handleReject} disabled={saving} className="text-[13px] font-medium text-red-600 hover:bg-red-50 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">Rechazar</button>
        <div className="flex gap-2">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cancelar</button>
          <button onClick={handleApprove} disabled={saving}
            className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {saving ? "Guardando…" : "Aprobar"}
          </button>
        </div>
      </>}>
      <div className="p-5 space-y-3">
        <p className="text-[12.5px] text-gray-600">
          Documento: <strong>{record.idDocumentType} {record.idDocumentNumber}</strong>
          {record.riskLevel && <> · Riesgo: <strong>{record.riskLevel}</strong></>}
          {record.isPep && <> · <span className="text-red-600 font-semibold">Persona Expuesta Políticamente</span></>}
        </p>
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">Notas (obligatorio si rechazas)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary resize-none" />
        </div>
        {error && <p className="text-[11.5px] text-red-500">{error}</p>}
      </div>
    </ModalShell>
  );
}
