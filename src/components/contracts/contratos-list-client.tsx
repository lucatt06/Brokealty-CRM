"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSignature, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { markContractSent, markContractSigned, voidContract } from "@/app/actions/contracts";

type ContractRow = {
  id: string;
  status: "GENERADO" | "ENVIADO" | "FIRMADO" | "ANULADO";
  documentUrl: string | null;
  templateName: string;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
  salesOrder: { id: string; orderNumber: string; leadName: string; propertyLabel: string };
};

const STATUS_CLS: Record<ContractRow["status"], string> = {
  GENERADO: "bg-gray-100 text-gray-600 border-gray-300",
  ENVIADO: "bg-blue-100 text-blue-700 border-blue-300",
  FIRMADO: "bg-green-100 text-green-700 border-green-300",
  ANULADO: "bg-red-100 text-red-700 border-red-300",
};
const STATUS_LABEL: Record<ContractRow["status"], string> = {
  GENERADO: "Generado", ENVIADO: "Enviado", FIRMADO: "Firmado", ANULADO: "Anulado",
};

export function ContratosListClient({ contracts, isAdmin }: { contracts: ContractRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"TODOS" | ContractRow["status"]>("TODOS");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = contracts.filter((c) => statusFilter === "TODOS" || c.status === statusFilter);

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Contratos generados a partir de órdenes de venta — envío, firma y anulación.</p>
        </div>

        <div className="flex items-center gap-1.5">
          {(["TODOS", "GENERADO", "ENVIADO", "FIRMADO", "ANULADO"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors",
                statusFilter === s ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}>
              {s === "TODOS" ? "Todos" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <FileSignature className="h-12 w-12 opacity-20" />
            <p className="text-sm">No hay contratos{statusFilter !== "TODOS" ? ` en estado "${STATUS_LABEL[statusFilter]}"` : ""}. Se generan desde el detalle de una Orden de Venta.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 px-4">Orden</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Cliente</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Propiedad</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Plantilla</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Estado</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Documento</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-4">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="py-2.5 px-4">
                      <Link href={`/ordenes-venta/${c.salesOrder.id}`} className="font-semibold text-primary hover:underline">{c.salesOrder.orderNumber}</Link>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-700">{c.salesOrder.leadName}</td>
                    <td className="py-2.5 pr-3 text-gray-500">{c.salesOrder.propertyLabel}</td>
                    <td className="py-2.5 pr-3 text-gray-500">{c.templateName}</td>
                    <td className="py-2.5 pr-3">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", STATUS_CLS[c.status])}>{STATUS_LABEL[c.status]}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {c.documentUrl ? (
                        <a href={c.documentUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          <FileText className="h-3 w-3" /> PDF
                        </a>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      {isAdmin && c.status !== "FIRMADO" && c.status !== "ANULADO" && (
                        <div className="flex items-center gap-2">
                          {c.status === "GENERADO" && (
                            <button disabled={busyId === c.id} onClick={() => run(c.id, () => markContractSent(c.id))}
                              className="text-[11.5px] font-medium text-primary hover:underline disabled:opacity-50">Marcar enviado</button>
                          )}
                          <button disabled={busyId === c.id} onClick={() => run(c.id, () => markContractSigned(c.id))}
                            className="text-[11.5px] font-medium text-green-600 hover:underline disabled:opacity-50">Marcar firmado</button>
                          <button disabled={busyId === c.id} onClick={() => run(c.id, () => voidContract(c.id))}
                            className="text-[11.5px] font-medium text-red-500 hover:underline disabled:opacity-50">Anular</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
