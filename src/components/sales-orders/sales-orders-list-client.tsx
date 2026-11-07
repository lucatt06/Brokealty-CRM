"use client";

import { useState } from "react";
import Link from "next/link";
import { FileCheck, AlertTriangle, Car } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

type Order = {
  id: string;
  orderNumber: string;
  status: "BORRADOR" | "PENDIENTE_AUTORIZACION" | "AUTORIZADA" | "EN_PROCESO" | "COMPLETADA" | "CANCELADA";
  salePrice: number;
  currency: string;
  createdAt: string;
  lead: { id: string; firstName: string; lastName: string | null };
  vehicle: { id: string; make: string; model: string; year: number };
  authorizations: { id: string }[];
};

type Procedure = {
  id: string;
  type: string;
  status: "PENDIENTE" | "EN_PROCESO" | "COMPLETADO" | "CANCELADO";
  dueDate: string | null;
  salesOrder: { id: string; orderNumber: string };
  assignedTo: { id: string; name: string } | null;
};

const STATUS_CFG: Record<Order["status"], { label: string; cls: string }> = {
  BORRADOR: { label: "Borrador", cls: "bg-gray-100 text-gray-600 border-gray-300" },
  PENDIENTE_AUTORIZACION: { label: "Pendiente autorización", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  AUTORIZADA: { label: "Autorizada", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  EN_PROCESO: { label: "En proceso", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  COMPLETADA: { label: "Completada", cls: "bg-green-100 text-green-700 border-green-300" },
  CANCELADA: { label: "Cancelada", cls: "bg-red-100 text-red-700 border-red-300" },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export function SalesOrdersListClient({ orders, pendingProcedures }: { orders: Order[]; pendingProcedures: Procedure[] }) {
  const [tab, setTab] = useState<"ordenes" | "tramites">("ordenes");

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Órdenes de Venta</h1>
          <p className="text-sm text-muted-foreground mt-0.5">El punto de control formal de cada venta — cotización, DDC, autorización, contrato y trámites.</p>
        </div>

        <div className="flex items-center gap-1 border-b border-gray-200">
          {([
            { key: "ordenes", label: `Órdenes (${orders.length})` },
            { key: "tramites", label: `Trámites pendientes (${pendingProcedures.length})` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn("px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                tab === key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700")}>
              {label}
            </button>
          ))}
        </div>

        {tab === "ordenes" ? (
          orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
              <FileCheck className="h-12 w-12 opacity-20" />
              <p className="text-sm">Aún no hay órdenes de venta. Se crean automáticamente al marcar un negocio como &quot;Ganado&quot;.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-[12px] border-collapse">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 px-4">Orden</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Cliente</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Vehículo</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Precio</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Estado</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-4">Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="py-2.5 px-4">
                        <Link href={`/ordenes-venta/${o.id}`} className="font-semibold text-primary hover:underline">{o.orderNumber}</Link>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700">{o.lead.firstName} {o.lead.lastName ?? ""}</td>
                      <td className="py-2.5 pr-3 text-gray-500">{o.vehicle.make} {o.vehicle.model} {o.vehicle.year}</td>
                      <td className="py-2.5 pr-3 font-semibold text-gray-800">{formatCurrency(o.salePrice, o.currency === "USD" ? "USD" : "DOP")}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", STATUS_CFG[o.status].cls)}>{STATUS_CFG[o.status].label}</span>
                          {o.authorizations.length > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-400">{fmtDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : pendingProcedures.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <Car className="h-12 w-12 opacity-20" />
            <p className="text-sm">No hay trámites pendientes.</p>
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
                {pendingProcedures.map((p) => {
                  const overdue = p.dueDate && new Date(p.dueDate) < new Date();
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="py-2.5 px-4 font-medium text-gray-800">{p.type.replace(/_/g, " ")}</td>
                      <td className="py-2.5 pr-3">
                        <Link href={`/ordenes-venta/${p.salesOrder.id}`} className="text-primary hover:underline">{p.salesOrder.orderNumber}</Link>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500">{p.assignedTo?.name ?? "Sin asignar"}</td>
                      <td className={cn("py-2.5 pr-3", overdue ? "text-red-600 font-semibold" : "text-gray-500")}>{fmtDate(p.dueDate)}</td>
                      <td className="py-2.5 pr-4 text-gray-500">{p.status === "EN_PROCESO" ? "En proceso" : "Pendiente"}</td>
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
