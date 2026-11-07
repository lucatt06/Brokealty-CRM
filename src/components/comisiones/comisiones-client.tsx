"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, X, Check, Ban } from "lucide-react";
import {
  approveCommission, rejectCommission, markCommissionPaid,
  createCommissionRule, updateCommissionRule, toggleCommissionRuleActive, deleteCommissionRule,
} from "@/app/actions/commissions";

type CommissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";
type CalcType = "PERCENT_OF_VALUE" | "PERCENT_OF_MARGIN" | "FIXED_AMOUNT";

type Commission = {
  id: string; dealId: string; leadName: string; vehicleLabel: string | null;
  userId: string; userName: string; ruleName: string | null;
  baseAmount: number; amount: number; currency: string; status: CommissionStatus;
  approvedByName: string | null; approvedAt: string | null; rejectionReason: string | null;
  paidAt: string | null; createdAt: string;
};

type CommissionRule = {
  id: string; name: string; calcType: CalcType; percent: number | null; fixedAmount: number | null;
  isActive: boolean; createdAt: string;
};

const STATUS_CFG: Record<CommissionStatus, { label: string; bg: string; text: string }> = {
  PENDING:  { label: "Pendiente",  bg: "bg-yellow-50", text: "text-yellow-700" },
  APPROVED: { label: "Aprobada",   bg: "bg-purple-50", text: "text-purple-700" },
  REJECTED: { label: "Rechazada",  bg: "bg-red-50",    text: "text-red-600" },
  PAID:     { label: "Pagada",     bg: "bg-green-50",  text: "text-green-700" },
};

const CALC_TYPE_LABEL: Record<CalcType, string> = {
  PERCENT_OF_VALUE: "% del valor de venta",
  PERCENT_OF_MARGIN: "% del margen (venta − costo)",
  FIXED_AMOUNT: "Monto fijo",
};

function fmt(v: number, cur: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: cur === "USD" ? "USD" : "DOP", maximumFractionDigits: 0 }).format(v);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export function ComisionesClient({
  workspaceId, isAdmin, commissions, rules,
}: {
  workspaceId: string; isAdmin: boolean;
  commissions: Commission[]; rules: CommissionRule[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"commissions" | "rules">("commissions");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const now = new Date();
  const isThisMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  const pendingC = commissions.filter((c) => c.status === "PENDING");
  const approvedC = commissions.filter((c) => c.status === "APPROVED");
  const paidThisMonth = commissions.filter((c) => c.status === "PAID" && c.paidAt && isThisMonth(c.paidAt));
  const rejectedC = commissions.filter((c) => c.status === "REJECTED");

  const sum = (list: Commission[]) => list.reduce((s, c) => s + c.amount, 0);

  async function run(id: string, fn: () => Promise<void>) {
    setPending(id);
    await fn();
    router.refresh();
    setPending(null);
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    await run(id, () => rejectCommission(id, rejectReason));
    setRejectingId(null);
    setRejectReason("");
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-foreground">Comisiones</h1>
        {isAdmin && (
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setTab("commissions")}
              className={cn("text-xs font-medium px-3 py-1.5 rounded-md transition-colors", tab === "commissions" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
            >
              Comisiones
            </button>
            <button
              onClick={() => setTab("rules")}
              className={cn("text-xs font-medium px-3 py-1.5 rounded-md transition-colors", tab === "rules" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
            >
              Reglas
            </button>
          </div>
        )}
      </div>

      {tab === "commissions" ? (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <Tile label="Pendientes" value={fmt(sum(pendingC), "DOP")} count={pendingC.length} bg="bg-yellow-50" border="border-yellow-100" text="text-yellow-700" />
            <Tile label="Aprobadas" value={fmt(sum(approvedC), "DOP")} count={approvedC.length} bg="bg-purple-50" border="border-purple-100" text="text-purple-700" />
            <Tile label="Pagadas este mes" value={fmt(sum(paidThisMonth), "DOP")} count={paidThisMonth.length} bg="bg-green-50" border="border-green-100" text="text-green-700" />
            <Tile label="Rechazadas" value={String(rejectedC.length)} count={null} bg="bg-red-50" border="border-red-100" text="text-red-600" />
          </div>

          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 text-center mt-12">
              {isAdmin ? "Todavía no hay comisiones calculadas." : "Todavía no tienes comisiones."}
            </p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {isAdmin && <th className="text-left font-medium px-3 py-2">Vendedor</th>}
                    <th className="text-left font-medium px-3 py-2">Negocio</th>
                    <th className="text-left font-medium px-3 py-2">Regla</th>
                    <th className="text-right font-medium px-3 py-2">Monto</th>
                    <th className="text-left font-medium px-3 py-2">Estado</th>
                    <th className="text-left font-medium px-3 py-2">Fecha</th>
                    {isAdmin && <th className="text-right font-medium px-3 py-2">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-t border-border/60">
                      {isAdmin && <td className="px-3 py-2.5">{c.userName}</td>}
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{c.leadName}</div>
                        {c.vehicleLabel && <div className="text-xs text-muted-foreground">{c.vehicleLabel}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.ruleName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{fmt(c.amount, c.currency)}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("text-[11px] rounded-full px-2 py-0.5 font-medium", STATUS_CFG[c.status].bg, STATUS_CFG[c.status].text)}>
                          {STATUS_CFG[c.status].label}
                        </span>
                        {c.status === "REJECTED" && c.rejectionReason && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 italic">{c.rejectionReason}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtDate(c.createdAt)}</td>
                      {isAdmin && (
                        <td className="px-3 py-2.5">
                          {rejectingId === c.id ? (
                            <div className="flex items-center gap-1.5 justify-end">
                              <input
                                autoFocus value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Motivo…" className="text-xs border border-border rounded-md px-2 py-1 w-32 outline-none"
                              />
                              <button onClick={() => handleReject(c.id)} disabled={pending === c.id} className="text-red-600 hover:text-red-700">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="text-muted-foreground hover:text-foreground">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-end">
                              {c.status === "PENDING" && (
                                <>
                                  <button
                                    onClick={() => run(c.id, () => approveCommission(c.id))}
                                    disabled={pending === c.id}
                                    className="text-[11px] font-medium text-purple-600 hover:underline"
                                  >
                                    Aprobar
                                  </button>
                                  <button onClick={() => setRejectingId(c.id)} className="text-[11px] font-medium text-red-500 hover:underline">
                                    Rechazar
                                  </button>
                                </>
                              )}
                              {c.status === "APPROVED" && (
                                <button
                                  onClick={() => run(c.id, () => markCommissionPaid(c.id))}
                                  disabled={pending === c.id}
                                  className="text-[11px] font-medium text-green-600 hover:underline"
                                >
                                  Marcar pagada
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <RulesTab workspaceId={workspaceId} rules={rules} />
      )}
    </div>
  );
}

function Tile({ label, value, count, bg, border, text }: { label: string; value: string; count: number | null; bg: string; border: string; text: string }) {
  return (
    <div className={cn("rounded-lg p-3 border", bg, border)}>
      <p className={cn("text-[11px] font-medium", text)}>{label}</p>
      <p className={cn("text-base font-bold", text)}>{value}</p>
      {count !== null && <p className={cn("text-[10px] opacity-70", text)}>{count} comisión{count !== 1 ? "es" : ""}</p>}
    </div>
  );
}

function RulesTab({ workspaceId, rules }: { workspaceId: string; rules: CommissionRule[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", calcType: "PERCENT_OF_VALUE" as CalcType, percent: "", fixedAmount: "" });
  const [pending, setPending] = useState(false);

  function openCreate() {
    setForm({ name: "", calcType: "PERCENT_OF_VALUE", percent: "", fixedAmount: "" });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(r: CommissionRule) {
    setForm({ name: r.name, calcType: r.calcType, percent: r.percent != null ? String(r.percent) : "", fixedAmount: r.fixedAmount != null ? String(r.fixedAmount) : "" });
    setEditingId(r.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setPending(true);
    const data = {
      name: form.name,
      calcType: form.calcType,
      percent: form.calcType !== "FIXED_AMOUNT" ? Number(form.percent) || null : null,
      fixedAmount: form.calcType === "FIXED_AMOUNT" ? Number(form.fixedAmount) || null : null,
    };
    if (editingId) await updateCommissionRule(editingId, data);
    else await createCommissionRule(workspaceId, data);
    router.refresh();
    setShowForm(false);
    setPending(false);
  }

  async function handleToggle(id: string, isActive: boolean) {
    await toggleCommissionRuleActive(id, isActive);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await deleteCommissionRule(id);
    router.refresh();
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {rules.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground/60 text-center mt-6">Sin reglas configuradas — sin ninguna regla activa, las comisiones no se calculan automáticamente.</p>
      )}

      {rules.map((r) => (
        <div key={r.id} className="border border-border rounded-lg p-3 flex items-center justify-between bg-white">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{r.name}</p>
              <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 font-medium", r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                {r.isActive ? "Activa" : "Inactiva"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {CALC_TYPE_LABEL[r.calcType]}
              {r.calcType === "FIXED_AMOUNT" ? ` · ${fmt(r.fixedAmount ?? 0, "DOP")}` : ` · ${r.percent ?? 0}%`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => handleToggle(r.id, !r.isActive)} className="text-xs text-muted-foreground hover:text-foreground">
              {r.isActive ? <Ban className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => openEdit(r)} className="text-xs text-primary hover:underline">Editar</button>
            <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:underline">Borrar</button>
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
          <input
            value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre de la regla"
            className="w-full text-sm border border-border rounded-md px-2.5 py-1.5 outline-none bg-white"
          />
          <select
            value={form.calcType} onChange={(e) => setForm((f) => ({ ...f, calcType: e.target.value as CalcType }))}
            className="w-full text-sm border border-border rounded-md px-2.5 py-1.5 outline-none bg-white"
          >
            {(Object.entries(CALC_TYPE_LABEL) as [CalcType, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {form.calcType === "FIXED_AMOUNT" ? (
            <input
              type="number" min="0" step="0.01" value={form.fixedAmount} onChange={(e) => setForm((f) => ({ ...f, fixedAmount: e.target.value }))}
              placeholder="Monto fijo (DOP)" className="w-full text-sm border border-border rounded-md px-2.5 py-1.5 outline-none bg-white"
            />
          ) : (
            <input
              type="number" min="0" max="100" step="0.1" value={form.percent} onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))}
              placeholder="Porcentaje (%)" className="w-full text-sm border border-border rounded-md px-2.5 py-1.5 outline-none bg-white"
            />
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
            <Button size="sm" disabled={!form.name.trim() || pending} onClick={handleSave} className="h-7 px-3 text-xs">
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      ) : (
        <button onClick={openCreate} className="text-sm text-primary hover:underline flex items-center gap-1 mt-2">
          <Plus className="h-4 w-4" />Nueva regla
        </button>
      )}
    </div>
  );
}
