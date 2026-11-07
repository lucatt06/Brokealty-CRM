"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, XCircle, FileDown, Upload, Loader2,
  ShieldAlert, FileText, ClipboardList, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { completeSalesOrder, updateSalesOrderTerms, cancelSalesOrder } from "@/app/actions/sales-orders";
import { approveAuthorization, rejectAuthorization } from "@/app/actions/sales-authorizations";
import { createOrUpdateDdc, approveDdc, rejectDdc } from "@/app/actions/due-diligence";
import { generateContract, markContractSent, markContractSigned, voidContract } from "@/app/actions/contracts";
import { createOperationDocument } from "@/app/actions/operation-documents";
import { updateProcedureStatus, assignProcedure } from "@/app/actions/post-sale-procedures";
import type { IdDocumentType, OperationDocumentType, ProcedureStatus, SalesPaymentMethod } from "@prisma/client";

// ── Tipos (calcados de la serialización del server component) ──
type Ddc = {
  id: string; idDocumentType: IdDocumentType; idDocumentNumber: string; fullLegalName: string;
  isPep: boolean; riskLevel: "BAJO" | "MEDIO" | "ALTO" | null; status: "PENDIENTE" | "EN_REVISION" | "APROBADO" | "RECHAZADO";
  reviewNotes: string | null; rejectionReason: string | null; expiresAt: string | null; createdAt: string;
};
type Authorization = {
  id: string; trigger: string; triggerDetail: string | null; status: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  decisionNotes: string | null; requestedBy: { name: string }; decidedBy: { name: string } | null; createdAt: string;
};
type Contract = {
  id: string; status: "GENERADO" | "ENVIADO" | "FIRMADO" | "ANULADO"; documentUrl: string | null;
  template: { id: string; name: string } | null; createdAt: string;
};
type OpDocument = { id: string; type: OperationDocumentType; name: string; url: string; createdAt: string };
type Procedure = {
  id: string; type: string; status: ProcedureStatus; dueDate: string | null;
  assignedTo: { id: string; name: string } | null;
};
type Order = {
  id: string; orderNumber: string; status: "BORRADOR" | "PENDIENTE_AUTORIZACION" | "AUTORIZADA" | "EN_PROCESO" | "COMPLETADA" | "CANCELADA";
  salePrice: number; currency: string; paymentMethod: SalesPaymentMethod; downPayment: number | null; installments: number | null; conditionsText: string | null;
  lead: { id: string; firstName: string; lastName: string | null; phone: string };
  vehicle: { id: string; make: string; model: string; year: number; vin: string | null };
  quote: { id: string; quoteNumber: string } | null;
  ddc: Ddc | null;
  soldBy: { id: string; name: string };
  authorizations: Authorization[];
  contracts: Contract[];
  documents: OpDocument[];
  procedures: Procedure[];
};

const STATUS_CFG: Record<Order["status"], { label: string; cls: string }> = {
  BORRADOR: { label: "Borrador", cls: "bg-gray-100 text-gray-600 border-gray-300" },
  PENDIENTE_AUTORIZACION: { label: "Pendiente autorización", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  AUTORIZADA: { label: "Autorizada", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  EN_PROCESO: { label: "En proceso", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  COMPLETADA: { label: "Completada", cls: "bg-green-100 text-green-700 border-green-300" },
  CANCELADA: { label: "Cancelada", cls: "bg-red-100 text-red-700 border-red-300" },
};

const PAYMENT_LABELS: Record<string, string> = { CONTADO: "Contado", FINANCIAMIENTO_BANCARIO: "Financiamiento bancario", MIXTO: "Mixto", OTRO: "Otro" };
const DDC_STATUS_LABELS: Record<string, string> = { PENDIENTE: "Pendiente", EN_REVISION: "En revisión", APROBADO: "Aprobado", RECHAZADO: "Rechazado" };
const OP_DOC_TYPES: OperationDocumentType[] = ["CEDULA", "PASAPORTE", "CONTRATO", "COMPROBANTE_PAGO", "DDC_SOPORTE", "MATRICULA", "SEGURO", "OTRO"];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export function SalesOrderDetailClient({ order, leadDdcs, templates, users, canManage, workspaceId }: {
  order: Order; leadDdcs: Ddc[]; templates: { id: string; name: string }[]; users: { id: string; name: string }[]; canManage: boolean; workspaceId: string;
}) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [section, setSection] = useState<Set<string>>(new Set(["ddc", "autorizacion", "contrato", "documentos", "tramites"]));

  function toggle(key: string) {
    setSection((prev) => { const s = new Set(prev); if (s.has(key)) s.delete(key); else s.add(key); return s; });
  }

  async function handleComplete() {
    setCompleting(true);
    setCompleteError(null);
    try {
      await completeSalesOrder(order.id);
      router.refresh();
    } catch (e) {
      setCompleteError(e instanceof Error ? e.message : "No se pudo completar la venta.");
    } finally {
      setCompleting(false);
    }
  }

  const isFinal = order.status === "COMPLETADA" || order.status === "CANCELADA";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-12 flex items-center gap-3 border-b border-border bg-card px-3 shrink-0">
        <button onClick={() => router.push("/ordenes-venta")} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-[14px] font-semibold text-foreground truncate">{order.orderNumber}</h1>
        <Badge className={cn("text-[11px] border font-medium shrink-0", STATUS_CFG[order.status].cls)}>{STATUS_CFG[order.status].label}</Badge>
        {!isFinal && (
          <div className="ml-auto flex items-center gap-2">
            {completeError && <span className="text-[11px] text-destructive max-w-[360px] truncate" title={completeError}>{completeError}</span>}
            <Button size="sm" onClick={handleComplete} disabled={completing} className="h-8 text-xs">
              {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Completar venta"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Columna 1 */}
        <div className="w-[320px] shrink-0 border-r border-border bg-white overflow-y-auto">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Cliente</p>
            <Link href={`/leads/${order.lead.id}`} className="text-[13px] font-semibold text-primary hover:underline">{order.lead.firstName} {order.lead.lastName ?? ""}</Link>
            <p className="text-[11px] text-muted-foreground">{order.lead.phone}</p>
          </div>
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Vehículo</p>
            <Link href={`/inventario/${order.vehicle.id}`} className="text-[13px] font-semibold text-primary hover:underline">{order.vehicle.make} {order.vehicle.model} {order.vehicle.year}</Link>
            {order.vehicle.vin && <p className="text-[11px] text-muted-foreground">VIN {order.vehicle.vin}</p>}
          </div>
          {order.quote && (
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Cotización de origen</p>
              <p className="text-[13px] font-medium">{order.quote.quoteNumber}</p>
            </div>
          )}
          <TermsSection order={order} canEdit={canManage && !isFinal} />
          {canManage && !isFinal && <CancelOrderBox orderId={order.id} onDone={() => router.refresh()} />}
        </div>

        {/* Columna 2 */}
        <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6 space-y-4">
          <DdcCard order={order} leadDdcs={leadDdcs} canManage={canManage} open={section.has("ddc")} onToggle={() => toggle("ddc")} workspaceId={workspaceId} />
          {order.authorizations.length > 0 && (
            <AuthorizationCard authorizations={order.authorizations} canManage={canManage} open={section.has("autorizacion")} onToggle={() => toggle("autorizacion")} />
          )}
          <ContractCard order={order} templates={templates} open={section.has("contrato")} onToggle={() => toggle("contrato")} />
          <DocumentsCard order={order} open={section.has("documentos")} onToggle={() => toggle("documentos")} workspaceId={workspaceId} />
          <ProceduresCard procedures={order.procedures} users={users} open={section.has("tramites")} onToggle={() => toggle("tramites")} />
        </div>
      </div>
    </div>
  );
}

function SectionShell({ title, icon: Icon, open, onToggle, children, action }: {
  title: string; icon: React.ElementType; open: boolean; onToggle: () => void; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 transition-colors">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-gray-900"><Icon className="h-4 w-4 text-gray-400" /> {title}</span>
        <span className="flex items-center gap-2">
          {action}
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </span>
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-100 pt-3">{children}</div>}
    </div>
  );
}

// ── Términos ──
function TermsSection({ order, canEdit }: { order: Order; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [salePrice, setSalePrice] = useState(String(order.salePrice));
  const [paymentMethod, setPaymentMethod] = useState<SalesPaymentMethod>(order.paymentMethod);
  const [downPayment, setDownPayment] = useState(order.downPayment != null ? String(order.downPayment) : "");
  const [installments, setInstallments] = useState(order.installments != null ? String(order.installments) : "");
  const [conditionsText, setConditionsText] = useState(order.conditionsText ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateSalesOrderTerms(order.id, {
      salePrice: Number(salePrice), currency: order.currency, paymentMethod,
      downPayment: downPayment ? Number(downPayment) : null, installments: installments ? Number(installments) : null,
      conditionsText: conditionsText || null,
    });
    setSaving(false); setEditing(false); router.refresh();
  }

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Términos</p>
        {canEdit && !editing && <button onClick={() => setEditing(true)} className="text-[11px] text-primary hover:underline">Editar</button>}
      </div>
      {editing ? (
        <div className="space-y-2">
          <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="w-full text-[12px] border border-border rounded-md px-2 py-1.5" placeholder="Precio" />
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as SalesPaymentMethod)} className="w-full text-[12px] border border-border rounded-md px-2 py-1.5 bg-white">
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} className="w-full text-[12px] border border-border rounded-md px-2 py-1.5" placeholder="Inicial" />
          <input type="number" value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-full text-[12px] border border-border rounded-md px-2 py-1.5" placeholder="Cuotas" />
          <textarea value={conditionsText} onChange={(e) => setConditionsText(e.target.value)} rows={2} className="w-full text-[12px] border border-border rounded-md px-2 py-1.5 resize-none" placeholder="Condiciones" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs flex-1">{saving ? "Guardando…" : "Guardar"}</Button>
            <button onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground px-2">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-[15px] font-bold text-gray-900">{formatCurrency(order.salePrice, order.currency === "USD" ? "USD" : "DOP")}</p>
          <p className="text-[11px] text-muted-foreground">{PAYMENT_LABELS[order.paymentMethod]}</p>
          {order.downPayment != null && <p className="text-[11px] text-muted-foreground">Inicial: {formatCurrency(order.downPayment, order.currency === "USD" ? "USD" : "DOP")}</p>}
          {order.installments != null && <p className="text-[11px] text-muted-foreground">{order.installments} cuotas</p>}
        </div>
      )}
    </div>
  );
}

function CancelOrderBox({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCancel() {
    if (!reason.trim()) return;
    setSaving(true);
    await cancelSalesOrder(orderId, reason);
    setSaving(false); setOpen(false); onDone();
  }

  return (
    <div className="px-4 py-3">
      {open ? (
        <div className="space-y-2">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Motivo de la cancelación…" className="w-full text-[12px] border border-destructive/30 rounded-md px-2 py-1.5 resize-none" />
          <div className="flex gap-2">
            <button onClick={handleCancel} disabled={saving || !reason.trim()} className="text-[11px] font-medium text-white bg-destructive rounded-md px-3 py-1.5 disabled:opacity-50">{saving ? "Cancelando…" : "Confirmar cancelación"}</button>
            <button onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground px-2">Cerrar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="text-[11px] text-destructive hover:underline">Cancelar orden de venta</button>
      )}
    </div>
  );
}

// ── DDC ──
function DdcCard({ order, leadDdcs, canManage, open, onToggle, workspaceId }: {
  order: Order; leadDdcs: Ddc[]; canManage: boolean; open: boolean; onToggle: () => void; workspaceId: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const ddc = order.ddc;

  async function handleApprove() {
    if (!ddc) return;
    setBusy(true); await approveDdc(ddc.id); setBusy(false); router.refresh();
  }
  async function handleReject() {
    if (!ddc) return;
    const reason = prompt("Motivo del rechazo:");
    if (!reason) return;
    setBusy(true); await rejectDdc(ddc.id, reason); setBusy(false); router.refresh();
  }

  const statusCls = ddc?.status === "APROBADO" ? "bg-green-100 text-green-700 border-green-300"
    : ddc?.status === "RECHAZADO" ? "bg-red-100 text-red-700 border-red-300"
    : "bg-amber-100 text-amber-700 border-amber-300";
  const riskCls = ddc?.riskLevel === "ALTO" ? "bg-red-100 text-red-700" : ddc?.riskLevel === "MEDIO" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";

  return (
    <SectionShell title="Debida Diligencia del Cliente" icon={ShieldAlert} open={open} onToggle={onToggle}
      action={ddc && <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", statusCls)}>{DDC_STATUS_LABELS[ddc.status]}</span>}>
      {!ddc ? (
        <div>
          <p className="text-[12px] text-muted-foreground mb-2">Este lead no tiene una Debida Diligencia vinculada — es obligatoria para completar la venta.</p>
          {leadDdcs.length > 0 && (
            <div className="mb-2 space-y-1">
              {leadDdcs.map((d) => (
                <button key={d.id} onClick={async () => { setBusy(true); await updateSalesOrderTerms(order.id, { salePrice: order.salePrice, currency: order.currency, paymentMethod: order.paymentMethod, ddcId: d.id }); setBusy(false); router.refresh(); }}
                  className="w-full text-left text-[12px] border border-border rounded-md px-2.5 py-1.5 hover:bg-muted transition-colors">
                  {d.fullLegalName} — {DDC_STATUS_LABELS[d.status]}
                </button>
              ))}
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => setCreating(true)} disabled={busy} className="h-7 text-xs">Nueva Debida Diligencia</Button>
          {creating && <NewDdcForm leadId={order.lead.id} workspaceId={workspaceId} onDone={() => { setCreating(false); router.refresh(); }} onCancel={() => setCreating(false)} />}
        </div>
      ) : (
        <div className="space-y-1.5 text-[12px]">
          <p><span className="text-muted-foreground">Nombre:</span> {ddc.fullLegalName}</p>
          <p><span className="text-muted-foreground">Documento:</span> {ddc.idDocumentType} {ddc.idDocumentNumber}</p>
          {ddc.riskLevel && <p className="flex items-center gap-1.5"><span className="text-muted-foreground">Riesgo:</span> <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", riskCls)}>{ddc.riskLevel}</span></p>}
          {ddc.isPep && <p className="text-red-600 font-medium">Persona Expuesta Políticamente</p>}
          {ddc.rejectionReason && <p className="text-red-600">Rechazada: {ddc.rejectionReason}</p>}
          {canManage && ddc.status !== "APROBADO" && ddc.status !== "RECHAZADO" && (
            <div className="flex gap-2 pt-1">
              <button onClick={handleApprove} disabled={busy} className="flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1"><CheckCircle2 className="h-3 w-3" /> Aprobar</button>
              <button onClick={handleReject} disabled={busy} className="flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1"><XCircle className="h-3 w-3" /> Rechazar</button>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}

function NewDdcForm({ leadId, workspaceId, onDone, onCancel }: { leadId: string; workspaceId: string; onDone: () => void; onCancel: () => void }) {
  const [fullLegalName, setFullLegalName] = useState("");
  const [idDocumentType, setIdDocumentType] = useState<IdDocumentType>("CEDULA");
  const [idDocumentNumber, setIdDocumentNumber] = useState("");
  const [isPep, setIsPep] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!fullLegalName.trim() || !idDocumentNumber.trim()) return;
    setSaving(true);
    await createOrUpdateDdc(null, leadId, workspaceId, { idDocumentType, idDocumentNumber, fullLegalName, isPep });
    setSaving(false); onDone();
  }

  return (
    <div className="mt-2 space-y-2 border-t border-border pt-2">
      <input value={fullLegalName} onChange={(e) => setFullLegalName(e.target.value)} placeholder="Nombre legal completo" className="w-full text-[12px] border border-border rounded-md px-2 py-1.5" />
      <div className="grid grid-cols-2 gap-2">
        <select value={idDocumentType} onChange={(e) => setIdDocumentType(e.target.value as IdDocumentType)} className="text-[12px] border border-border rounded-md px-2 py-1.5 bg-white">
          <option value="CEDULA">Cédula</option><option value="PASAPORTE">Pasaporte</option><option value="RNC">RNC</option><option value="OTRO">Otro</option>
        </select>
        <input value={idDocumentNumber} onChange={(e) => setIdDocumentNumber(e.target.value)} placeholder="Número" className="text-[12px] border border-border rounded-md px-2 py-1.5" />
      </div>
      <label className="flex items-center gap-1.5 text-[12px]">
        <input type="checkbox" checked={isPep} onChange={(e) => setIsPep(e.target.checked)} /> Persona Expuesta Políticamente
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={saving} className="h-7 text-xs flex-1">{saving ? "Guardando…" : "Crear"}</Button>
        <button onClick={onCancel} className="text-[11px] text-muted-foreground px-2">Cancelar</button>
      </div>
    </div>
  );
}

// ── Autorización ──
function AuthorizationCard({ authorizations, canManage, open, onToggle }: { authorizations: Authorization[]; canManage: boolean; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleApprove(id: string) {
    setBusy(true); await approveAuthorization(id); setBusy(false); router.refresh();
  }
  async function handleReject(id: string) {
    const notes = prompt("Motivo del rechazo:");
    if (!notes) return;
    setBusy(true); await rejectAuthorization(id, notes); setBusy(false); router.refresh();
  }

  return (
    <SectionShell title="Autorización de venta" icon={ShieldAlert} open={open} onToggle={onToggle}>
      <div className="space-y-2">
        {authorizations.map((a) => (
          <div key={a.id} className="border border-border rounded-lg p-2.5 text-[12px]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">{a.trigger.replace(/_/g, " ")}</span>
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded",
                a.status === "APROBADA" ? "bg-green-100 text-green-700" : a.status === "RECHAZADA" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                {a.status}
              </span>
            </div>
            {a.triggerDetail && <p className="text-muted-foreground">{a.triggerDetail}</p>}
            <p className="text-muted-foreground">Solicitado por {a.requestedBy.name}</p>
            {a.decidedBy && <p className="text-muted-foreground">Decidido por {a.decidedBy.name}{a.decisionNotes ? ` — ${a.decisionNotes}` : ""}</p>}
            {canManage && a.status === "PENDIENTE" && (
              <div className="flex gap-2 mt-1.5">
                <button onClick={() => handleApprove(a.id)} disabled={busy} className="flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1"><CheckCircle2 className="h-3 w-3" /> Aprobar</button>
                <button onClick={() => handleReject(a.id)} disabled={busy} className="flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1"><XCircle className="h-3 w-3" /> Rechazar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

// ── Contrato ──
function ContractCard({ order, templates, open, onToggle }: { order: Order; templates: { id: string; name: string }[]; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    if (!templateId) return;
    setBusy(true);
    await generateContract(order.id, templateId);
    setBusy(false); router.refresh();
  }

  return (
    <SectionShell title="Contrato" icon={FileText} open={open} onToggle={onToggle}>
      <div className="space-y-2">
        {order.contracts.map((c) => (
          <div key={c.id} className="flex items-center justify-between border border-border rounded-lg p-2.5 text-[12px]">
            <div>
              <p className="font-medium">{c.template?.name ?? "Contrato"}</p>
              <p className="text-muted-foreground">{c.status} · {fmtDate(c.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              {c.documentUrl && <a href={c.documentUrl} target="_blank" rel="noreferrer" className="text-primary"><FileDown className="h-4 w-4" /></a>}
              {c.status === "GENERADO" && (
                <button onClick={async () => { setBusy(true); await markContractSent(c.id); setBusy(false); router.refresh(); }} disabled={busy} className="text-[11px] text-primary hover:underline">Marcar enviado</button>
              )}
              {(c.status === "GENERADO" || c.status === "ENVIADO") && (
                <button onClick={async () => { setBusy(true); await markContractSigned(c.id); setBusy(false); router.refresh(); }} disabled={busy} className="text-[11px] text-green-700 hover:underline">Marcar firmado</button>
              )}
              {c.status !== "ANULADO" && (
                <button onClick={async () => { setBusy(true); await voidContract(c.id); setBusy(false); router.refresh(); }} disabled={busy} className="text-[11px] text-destructive hover:underline">Anular</button>
              )}
            </div>
          </div>
        ))}
        {templates.length > 0 ? (
          <div className="flex gap-2">
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="flex-1 text-[12px] border border-border rounded-md px-2 py-1.5 bg-white">
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Button size="sm" onClick={handleGenerate} disabled={busy} className="h-8 text-xs">Generar contrato</Button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No hay plantillas de contrato activas — créalas en Configuración → Contratos.</p>
        )}
      </div>
    </SectionShell>
  );
}

// ── Documentos ──
function DocumentsCard({ order, open, onToggle, workspaceId }: { order: Order; open: boolean; onToggle: () => void; workspaceId: string }) {
  const router = useRouter();
  const [type, setType] = useState<OperationDocumentType>("CEDULA");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!file || !name.trim()) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    await createOperationDocument(fd, { workspaceId, type, name, salesOrderId: order.id, leadId: order.lead.id });
    setUploading(false); setFile(null); setName("");
    router.refresh();
  }

  return (
    <SectionShell title="Documentos" icon={Upload} open={open} onToggle={onToggle}>
      <div className="space-y-2">
        {order.documents.map((d) => (
          <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between border border-border rounded-lg p-2.5 text-[12px] hover:bg-muted/40">
            <span>{d.name}</span>
            <span className="text-muted-foreground">{d.type.replace(/_/g, " ")}</span>
          </a>
        ))}
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as OperationDocumentType)} className="text-[12px] border border-border rounded-md px-2 py-1.5 bg-white">
              {OP_DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del documento" className="text-[12px] border border-border rounded-md px-2 py-1.5" />
          </div>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[11px]" />
          <Button size="sm" onClick={handleUpload} disabled={uploading || !file || !name.trim()} className="h-7 text-xs">{uploading ? "Subiendo…" : "Subir documento"}</Button>
        </div>
      </div>
    </SectionShell>
  );
}

// ── Trámites ──
function ProceduresCard({ procedures, users, open, onToggle }: { procedures: Procedure[]; users: { id: string; name: string }[]; open: boolean; onToggle: () => void }) {
  const router = useRouter();

  async function handleStatusChange(id: string, status: ProcedureStatus) {
    await updateProcedureStatus(id, status);
    router.refresh();
  }
  async function handleAssign(id: string, userId: string) {
    await assignProcedure(id, userId || null);
    router.refresh();
  }

  if (procedures.length === 0) {
    return (
      <SectionShell title="Trámites post-venta" icon={ClipboardList} open={open} onToggle={onToggle}>
        <p className="text-[12px] text-muted-foreground">Se generan automáticamente al completar la venta, según la configuración del workspace.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell title="Trámites post-venta" icon={ClipboardList} open={open} onToggle={onToggle}>
      <div className="space-y-2">
        {procedures.map((p) => (
          <div key={p.id} className="flex items-center justify-between border border-border rounded-lg p-2.5 text-[12px]">
            <div>
              <p className="font-medium">{p.type.replace(/_/g, " ")}</p>
              {p.dueDate && <p className="text-muted-foreground">Vence {fmtDate(p.dueDate)}</p>}
            </div>
            <div className="flex items-center gap-2">
              <select value={p.assignedTo?.id ?? ""} onChange={(e) => handleAssign(p.id, e.target.value)} className="text-[11px] border border-border rounded-md px-1.5 py-1 bg-white">
                <option value="">Sin asignar</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select value={p.status} onChange={(e) => handleStatusChange(p.id, e.target.value as ProcedureStatus)} className="text-[11px] border border-border rounded-md px-1.5 py-1 bg-white">
                <option value="PENDIENTE">Pendiente</option><option value="EN_PROCESO">En proceso</option><option value="COMPLETADO">Completado</option><option value="CANCELADO">Cancelado</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
