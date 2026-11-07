"use client";

import { useState } from "react";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { updateProcedureStatus, assignProcedure } from "@/app/actions/post-sale-procedures";
import type { ProcedureStatus, ProcedureType } from "@prisma/client";

type ProcedureRow = {
  id: string;
  type: ProcedureType;
  typeDetail: string | null;
  status: ProcedureStatus;
  dueDate: string | null;
  completedAt: string | null;
  documentUrl: string | null;
  salesOrder: { id: string; orderNumber: string };
  assignedTo: { id: string; name: string } | null;
};

const TYPE_LABEL: Record<ProcedureType, string> = {
  LEGALIZACION_CONTRATO: "Legalización de contrato", CERTIFICACION_ESTATUS_JURIDICO: "Certificación de estatus jurídico",
  IMPUESTO_TRANSFERENCIA: "Impuesto de transferencia", TRANSFERENCIA_TITULO: "Transferencia de título",
  ENTREGA_LLAVES: "Entrega de llaves", OTRO: "Otro",
};
const STATUS_LABEL: Record<ProcedureStatus, string> = {
  PENDIENTE: "Pendiente", EN_PROCESO: "En proceso", COMPLETADO: "Completado", CANCELADO: "Cancelado",
};
const STATUS_CLS: Record<ProcedureStatus, string> = {
  PENDIENTE: "bg-gray-100 text-gray-600 border-gray-300",
  EN_PROCESO: "bg-blue-100 text-blue-700 border-blue-300",
  COMPLETADO: "bg-green-100 text-green-700 border-green-300",
  CANCELADO: "bg-red-100 text-red-700 border-red-300",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export function TramitesListClient({ procedures, members }: { procedures: ProcedureRow[]; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"TODOS" | ProcedureStatus>("TODOS");

  const filtered = procedures.filter((p) => statusFilter === "TODOS" || p.status === statusFilter);

  async function handleStatusChange(id: string, status: ProcedureStatus) {
    await updateProcedureStatus(id, status);
    router.refresh();
  }
  async function handleAssign(id: string, userId: string) {
    await assignProcedure(id, userId || null);
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Control de Trámites</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Trámites post-venta: legalización de contrato, impuesto de transferencia, transferencia de título y entrega de llaves.</p>
        </div>

        <div className="flex items-center gap-1.5">
          {(["TODOS", "PENDIENTE", "EN_PROCESO", "COMPLETADO", "CANCELADO"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors",
                statusFilter === s ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}>
              {s === "TODOS" ? "Todos" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <Handshake className="h-12 w-12 opacity-20" />
            <p className="text-sm">No hay trámites{statusFilter !== "TODOS" ? ` en estado "${STATUS_LABEL[statusFilter]}"` : ""}.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 px-4">Trámite</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Orden</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Responsable</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Vencimiento</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-4">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const overdue = p.dueDate && p.status !== "COMPLETADO" && p.status !== "CANCELADO" && new Date(p.dueDate) < new Date();
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="py-2.5 px-4 font-medium text-gray-800">{TYPE_LABEL[p.type]}{p.typeDetail ? ` — ${p.typeDetail}` : ""}</td>
                      <td className="py-2.5 pr-3">
                        <Link href={`/ordenes-venta/${p.salesOrder.id}`} className="text-primary hover:underline">{p.salesOrder.orderNumber}</Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <select defaultValue={p.assignedTo?.id ?? ""} onChange={(e) => handleAssign(p.id, e.target.value)}
                          className="text-[12px] border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-primary bg-white">
                          <option value="">Sin asignar</option>
                          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </td>
                      <td className={cn("py-2.5 pr-3", overdue ? "text-red-600 font-semibold" : "text-gray-500")}>{fmtDate(p.dueDate)}</td>
                      <td className="py-2.5 pr-4">
                        <select defaultValue={p.status} onChange={(e) => handleStatusChange(p.id, e.target.value as ProcedureStatus)}
                          className={cn("text-[11px] font-semibold px-2 py-1 rounded-full border outline-none cursor-pointer", STATUS_CLS[p.status])}>
                          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
