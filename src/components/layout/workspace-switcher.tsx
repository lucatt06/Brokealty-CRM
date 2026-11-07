"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsUpDown, Plus, MoreVertical, Copy, Check, Loader2, Settings2, Ban, PlayCircle, Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { switchActiveWorkspace, createTenant, duplicateTenant, setTenantActive, deleteTenant, updateTenantPlan } from "@/app/actions/workspaces";

type WorkspaceInfo = { id: string; name: string; slug: string; logoUrl: string | null };
type WorkspaceListItem = WorkspaceInfo & { isActive: boolean; plan: string };

const PLAN_LABEL: Record<string, string> = { STARTER: "Starter", PRO: "Pro", ENTERPRISE: "Enterprise" };

export function WorkspaceSwitcher({ workspace, allWorkspaces, roleLabel }: {
  workspace: WorkspaceInfo; allWorkspaces: WorkspaceListItem[] | null; roleLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateFor, setDuplicateFor] = useState<WorkspaceListItem | null>(null);
  const [detailsFor, setDetailsFor] = useState<WorkspaceListItem | null>(null);
  const [switching, setSwitching] = useState(false);

  const isSuperAdmin = allWorkspaces !== null;

  async function handleSwitch(id: string) {
    if (id === workspace.id) { setOpen(false); return; }
    setSwitching(true);
    await switchActiveWorkspace(id);
    setOpen(false);
    setSwitching(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => isSuperAdmin && setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {workspace.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-left min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{workspace.name}</p>
            <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        {isSuperAdmin && <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {open && isSuperAdmin && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setMenuForId(null); }} />
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1.5 max-h-80 overflow-y-auto"
            >
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Tenants</p>
              {allWorkspaces!.map((ws) => (
                <div key={ws.id} className="relative flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-md mx-1">
                  <button onClick={() => handleSwitch(ws.id)} disabled={switching} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className={cn("text-[10px]", ws.isActive ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400")}>
                        {ws.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className={cn("truncate text-[12.5px] flex-1", ws.isActive ? "text-gray-700" : "text-gray-400")}>{ws.name}</span>
                    {!ws.isActive && <span className="text-[9.5px] font-medium text-red-500 bg-red-50 rounded-full px-1.5 py-0.5 shrink-0">Suspendido</span>}
                    {ws.id === workspace.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setMenuForId(menuForId === ws.id ? null : ws.id); }}
                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded shrink-0">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                  {menuForId === ws.id && (
                    <div className="absolute right-1 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-40">
                      <button
                        onClick={() => { setDuplicateFor(ws); setMenuForId(null); setOpen(false); }}
                        className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Copy className="h-3.5 w-3.5" /> Duplicar
                      </button>
                      <button
                        onClick={() => { setDetailsFor(ws); setMenuForId(null); setOpen(false); }}
                        className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Settings2 className="h-3.5 w-3.5" /> Detalles
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div className="border-t border-gray-100 mt-1.5 pt-1.5 px-1">
                <button
                  onClick={() => { setCreateOpen(true); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[12.5px] font-medium text-primary hover:bg-primary/5 rounded-md"
                >
                  <Plus className="h-3.5 w-3.5" /> Crear tenant
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createOpen && <CreateTenantModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); router.refresh(); }} />}
        {duplicateFor && (
          <DuplicateTenantModal
            source={duplicateFor}
            onClose={() => setDuplicateFor(null)}
            onDuplicated={() => { setDuplicateFor(null); router.refresh(); }}
          />
        )}
        {detailsFor && (
          <TenantDetailsModal
            tenant={detailsFor}
            onClose={() => setDetailsFor(null)}
            onChanged={() => { setDetailsFor(null); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true);
    setError("");
    try {
      await createTenant(name.trim());
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el tenant.");
      setSaving(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-white rounded-2xl shadow-2xl w-[380px]"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Crear tenant</h2>
          <p className="text-[11.5px] text-gray-400">Nueva inmobiliaria, vacía y lista para configurar</p>
        </div>
        <div className="p-5 space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">Nombre del negocio</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. AutoMax RD"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" autoFocus />
          {error && <p className="text-[11.5px] text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-gray-100">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {saving ? "Creando…" : "Crear"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DuplicateTenantModal({ source, onClose, onDuplicated }: { source: WorkspaceListItem; onClose: () => void; onDuplicated: () => void }) {
  const [name, setName] = useState(`${source.name} (copia)`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleDuplicate() {
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true);
    setError("");
    try {
      await duplicateTenant(source.id, name.trim());
      onDuplicated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo duplicar el tenant.");
      setSaving(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-white rounded-2xl shadow-2xl w-[420px]"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Duplicar &quot;{source.name}&quot;</h2>
          <p className="text-[11.5px] text-gray-400">Copia pipeline, agentes IA, automatizaciones, knowledge base y tags — sin leads, propiedades ni conversaciones</p>
        </div>
        <div className="p-5 space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">Nombre del nuevo tenant</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" autoFocus />
          {error && <p className="text-[11.5px] text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-gray-100">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cancelar</button>
          <button onClick={handleDuplicate} disabled={saving}
            className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Duplicando…</> : "Duplicar"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TenantDetailsModal({ tenant, onClose, onChanged }: { tenant: WorkspaceListItem; onClose: () => void; onChanged: () => void }) {
  const [plan, setPlan] = useState(tenant.plan);
  const [savingPlan, setSavingPlan] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");

  async function handleSavePlan() {
    if (plan === tenant.plan) return;
    setSavingPlan(true);
    setError("");
    try {
      await updateTenantPlan(tenant.id, plan as "STARTER" | "PRO" | "ENTERPRISE");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el plan.");
      setSavingPlan(false);
    }
  }

  async function handleToggleActive() {
    setTogglingActive(true);
    setError("");
    try {
      await setTenantActive(tenant.id, !tenant.isActive);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
      setTogglingActive(false);
    }
  }

  if (deleteOpen) {
    return <DeleteTenantModal tenant={tenant} onClose={() => setDeleteOpen(false)} onDeleted={onChanged} />;
  }

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-white rounded-2xl shadow-2xl w-[440px]"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">{tenant.name}</h2>
          <p className="text-[11.5px] text-gray-400">Detalles del tenant</p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-gray-700 block mb-1.5">Plan</label>
            <div className="flex gap-2">
              <select value={plan} onChange={(e) => setPlan(e.target.value)}
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary bg-white">
                {["STARTER", "PRO", "ENTERPRISE"].map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
              </select>
              <button onClick={handleSavePlan} disabled={savingPlan || plan === tenant.plan}
                className="text-[12.5px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3 py-2 transition-colors disabled:opacity-40">
                {savingPlan ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="text-[12px] font-semibold text-gray-700 block mb-1.5">Estado</label>
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
              <span className="text-[12.5px] text-gray-600">
                {tenant.isActive ? "Activo — el equipo puede iniciar sesión normalmente" : "Suspendido — nadie de este tenant puede operar"}
              </span>
              <button onClick={handleToggleActive} disabled={togglingActive}
                className={cn("flex items-center gap-1.5 text-[12px] font-medium rounded-md px-2.5 py-1.5 shrink-0 transition-colors disabled:opacity-50",
                  tenant.isActive ? "text-red-600 hover:bg-red-50" : "text-green-700 bg-green-50 hover:bg-green-100")}>
                {tenant.isActive ? <><Ban className="h-3.5 w-3.5" /> Suspender</> : <><PlayCircle className="h-3.5 w-3.5" /> Reactivar</>}
              </button>
            </div>
          </div>

          {error && <p className="text-[11.5px] text-red-500">{error}</p>}

          <div className="border-t border-gray-100 pt-4">
            <p className="text-[11px] font-semibold text-red-400 uppercase tracking-wide mb-1.5">Zona de peligro</p>
            <button onClick={() => setDeleteOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-md px-3 py-2 transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> Eliminar tenant permanentemente
            </button>
          </div>
        </div>

        <div className="flex justify-end px-5 py-3.5 border-t border-gray-100">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cerrar</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DeleteTenantModal({ tenant, onClose, onDeleted }: { tenant: WorkspaceListItem; onClose: () => void; onDeleted: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const matches = confirmText.trim() === tenant.name;

  async function handleDelete() {
    if (!matches) return;
    setSaving(true);
    setError("");
    try {
      await deleteTenant(tenant.id, confirmText.trim());
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el tenant.");
      setSaving(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-white rounded-2xl shadow-2xl w-[440px]"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Eliminar &quot;{tenant.name}&quot;</h2>
            <p className="text-[11.5px] text-gray-400">Esto borra TODO: leads, propiedades, conversaciones, agentes, todo. No se puede deshacer.</p>
          </div>
        </div>
        <div className="p-5 space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">
            Escribe <span className="font-mono text-red-600">{tenant.name}</span> para confirmar
          </label>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-red-400" autoFocus />
          {error && <p className="text-[11.5px] text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-gray-100">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cancelar</button>
          <button onClick={handleDelete} disabled={saving || !matches}
            className="text-[13px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-md px-3.5 py-2 transition-colors disabled:opacity-40">
            {saving ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
