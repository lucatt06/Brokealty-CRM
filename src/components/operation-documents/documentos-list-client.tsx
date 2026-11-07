"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderOpen, FileText, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createOperationDocument, deleteOperationDocument } from "@/app/actions/operation-documents";
import { ModalShell } from "@/components/agentes/action-modals";

type DocRow = {
  id: string;
  type: "CEDULA" | "PASAPORTE" | "CONTRATO" | "COMPROBANTE_PAGO" | "DDC_SOPORTE" | "TITULO_PROPIEDAD" | "CERTIFICACION_TITULO" | "OTRO";
  name: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  uploadedByName: string;
  salesOrder: { id: string; orderNumber: string } | null;
  lead: { id: string; firstName: string; lastName: string | null } | null;
};

const TYPE_LABEL: Record<DocRow["type"], string> = {
  CEDULA: "Cédula", PASAPORTE: "Pasaporte", CONTRATO: "Contrato", COMPROBANTE_PAGO: "Comprobante de pago",
  DDC_SOPORTE: "Soporte DDC", TITULO_PROPIEDAD: "Título de propiedad", CERTIFICACION_TITULO: "Certificación de título", OTRO: "Otro",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentosListClient({ workspaceId, documents, leads }: {
  workspaceId: string; documents: DocRow[]; leads: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<"TODOS" | DocRow["type"]>("TODOS");
  const [uploadOpen, setUploadOpen] = useState(false);

  const filtered = documents.filter((d) => typeFilter === "TODOS" || d.type === typeFilter);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este documento? Esta acción no se puede deshacer.")) return;
    await deleteOperationDocument(id);
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Documentos Digitales</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Repositorio de cédulas, contratos, comprobantes y otros documentos de clientes y ventas.</p>
          </div>
          <button onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors">
            <Upload className="h-3.5 w-3.5" /> Subir documento
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(["TODOS", ...Object.keys(TYPE_LABEL)] as ("TODOS" | DocRow["type"])[]).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn("text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors",
                typeFilter === t ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}>
              {t === "TODOS" ? "Todos" : TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <FolderOpen className="h-12 w-12 opacity-20" />
            <p className="text-sm">No hay documentos{typeFilter !== "TODOS" ? ` de tipo "${TYPE_LABEL[typeFilter]}"` : ""}.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 px-4">Documento</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Tipo</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Vinculado a</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Tamaño</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Subido por</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Fecha</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="py-2.5 px-4">
                      <a href={d.url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 shrink-0" /> {d.name}
                      </a>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-500">{TYPE_LABEL[d.type]}</td>
                    <td className="py-2.5 pr-3 text-gray-500">
                      {d.salesOrder ? (
                        <Link href={`/ordenes-venta/${d.salesOrder.id}`} className="text-primary hover:underline">{d.salesOrder.orderNumber}</Link>
                      ) : d.lead ? (
                        <Link href={`/leads/${d.lead.id}`} className="text-primary hover:underline">{d.lead.firstName} {d.lead.lastName ?? ""}</Link>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400">{fmtSize(d.sizeBytes)}</td>
                    <td className="py-2.5 pr-3 text-gray-500">{d.uploadedByName}</td>
                    <td className="py-2.5 pr-3 text-gray-400">{fmtDate(d.createdAt)}</td>
                    <td className="py-2.5 pr-4">
                      <button onClick={() => handleDelete(d.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {uploadOpen && (
        <UploadModal workspaceId={workspaceId} leads={leads} onClose={() => setUploadOpen(false)}
          onSaved={() => { setUploadOpen(false); router.refresh(); }} />
      )}
    </div>
  );
}

function UploadModal({ workspaceId, leads, onClose, onSaved }: {
  workspaceId: string; leads: { id: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DocRow["type"]>("OTRO");
  const [leadId, setLeadId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!file) { setError("Selecciona un archivo."); return; }
    if (!name.trim()) { setError("Ponle un nombre al documento."); return; }
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      await createOperationDocument(formData, { workspaceId, type, name, leadId: leadId || undefined });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el documento.");
      setSaving(false);
    }
  }

  return (
    <ModalShell icon={Upload} iconColor="text-primary" iconBg="bg-primary/10"
      title="Subir documento" subtitle="JPG, PNG, WEBP o PDF — hasta 15MB" onClose={onClose}
      width={440}
      footer={<>
        <div />
        <div className="flex gap-2">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {saving ? "Subiendo…" : "Subir"}
          </button>
        </div>
      </>}>
      <div className="p-5 space-y-3">
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cédula de Juan Pérez"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
        </div>
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value as DocRow["type"])}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary bg-white">
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">Vincular a lead (opcional)</label>
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary bg-white">
            <option value="">Sin vincular</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">Archivo</label>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-[12.5px]" />
        </div>
        {error && <p className="text-[11.5px] text-red-500">{error}</p>}
      </div>
    </ModalShell>
  );
}
