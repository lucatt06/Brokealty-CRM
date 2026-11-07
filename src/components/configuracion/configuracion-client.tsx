"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Building2, User, Users, Plus, Shield, MoreVertical, Check, Globe, FileSignature, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  updateWorkspaceGeneral, updateMyProfile, inviteTeamMember, updateMemberRole, toggleMemberActive,
} from "@/app/actions/settings";
import { PaginaWebTab, type WebsiteConfigInfo } from "@/components/pagina-web/pagina-web-tab";
import {
  createContractTemplate, updateContractTemplate, toggleContractTemplateActive,
} from "@/app/actions/contracts";
import {
  createAuthorizationRule, updateAuthorizationRule, toggleAuthorizationRuleActive, deleteAuthorizationRule,
} from "@/app/actions/sales-authorizations";
import { ModalShell, FieldLabel } from "@/components/agentes/action-modals";
import type { AuthorizationTrigger } from "@prisma/client";

type WorkspaceInfo = {
  id: string; name: string; logoUrl: string | null; currency: string; timezone: string;
  whatsappNumber: string | null; facebookPageId: string | null; instagramHandle: string | null;
};
type CurrentUser = { id: string; name: string; email: string; phone: string | null; avatarUrl: string | null; role: string } | null;
type Member = {
  id: string; role: string; isActive: boolean; joinedAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null; phone: string | null };
};
type ContractTemplateInfo = { id: string; name: string; documentType: string; bodyTemplate: string; isActive: boolean };
type AuthorizationRuleInfo = {
  id: string; name: string; trigger: AuthorizationTrigger; discountPercentThreshold: number | null;
  amountThreshold: number | null; requiredApproverRole: string; isActive: boolean;
};

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN_DEALER: "Admin Dealer", VENDEDOR: "Vendedor" };
const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-700",
  ADMIN_DEALER: "bg-blue-100 text-blue-700",
  VENDEDOR: "bg-gray-100 text-gray-600",
};
const CURRENCIES = ["DOP", "USD"];
const TIMEZONES = ["America/Santo_Domingo", "America/New_York", "America/Mexico_City", "America/Bogota"];

type Tab = "general" | "perfil" | "equipo" | "pagina-web" | "contratos";

export function ConfiguracionClient({ workspace, currentUser, members, websiteConfig, workspaceSlug, contractTemplates, authorizationRules }: {
  workspace: WorkspaceInfo; currentUser: CurrentUser; members: Member[]; websiteConfig: WebsiteConfigInfo; workspaceSlug: string;
  contractTemplates: ContractTemplateInfo[]; authorizationRules: AuthorizationRuleInfo[];
}) {
  const [tab, setTab] = useState<Tab>("general");
  const canManageTeam = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN_DEALER";

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Datos del negocio, tu perfil y el equipo.</p>
        </div>

        <div className="flex items-center gap-1 border-b border-gray-200">
          {([
            { key: "general", label: "General", Icon: Building2 },
            { key: "perfil", label: "Mi Perfil", Icon: User },
            { key: "equipo", label: "Equipo", Icon: Users },
            { key: "pagina-web", label: "Página Web", Icon: Globe },
            { key: "contratos", label: "Contratos", Icon: FileSignature },
          ] as const).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn("flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                tab === key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700")}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === "general" && <GeneralTab workspace={workspace} />}
        {tab === "perfil" && <PerfilTab currentUser={currentUser} />}
        {tab === "equipo" && <EquipoTab workspaceId={workspace.id} members={members} canManage={canManageTeam} />}
        {tab === "pagina-web" && <PaginaWebTab workspaceId={workspace.id} config={websiteConfig} slug={workspaceSlug} />}
        {tab === "contratos" && <ContratosTab workspaceId={workspace.id} templates={contractTemplates} rules={authorizationRules} />}
      </div>
    </div>
  );
}

// ── General ──────────────────────────────────────────────────────
function GeneralTab({ workspace }: { workspace: WorkspaceInfo }) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [logoUrl, setLogoUrl] = useState(workspace.logoUrl ?? "");
  const [currency, setCurrency] = useState(workspace.currency);
  const [timezone, setTimezone] = useState(workspace.timezone);
  const [whatsappNumber, setWhatsappNumber] = useState(workspace.whatsappNumber ?? "");
  const [facebookPageId, setFacebookPageId] = useState(workspace.facebookPageId ?? "");
  const [instagramHandle, setInstagramHandle] = useState(workspace.instagramHandle ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await updateWorkspaceGeneral(workspace.id, {
      name: name.trim(), logoUrl: logoUrl.trim() || null, currency, timezone,
      whatsappNumber: whatsappNumber.trim() || null, facebookPageId: facebookPageId.trim() || null, instagramHandle: instagramHandle.trim() || null,
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <FieldLabel required>Nombre del negocio</FieldLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
      </div>
      <div>
        <FieldLabel>URL del logo</FieldLabel>
        <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Moneda</FieldLabel>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary bg-white">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Zona horaria</FieldLabel>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary bg-white">
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="pt-2 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Información de contacto (referencial)</p>
        <div className="space-y-3">
          <div>
            <FieldLabel>WhatsApp</FieldLabel>
            <input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+1 809 555 5555" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </div>
          <div>
            <FieldLabel>Facebook Page ID</FieldLabel>
            <input value={facebookPageId} onChange={(e) => setFacebookPageId(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </div>
          <div>
            <FieldLabel>Instagram</FieldLabel>
            <input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@usuario" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Para conectar canales de verdad (WhatsApp, etc.) usa Integraciones — esto es solo información de referencia.</p>
      </div>
      <div className="flex justify-end pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-4 py-2 transition-colors disabled:opacity-50">
          {saved ? <><Check className="h-3.5 w-3.5" /> Guardado</> : saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

// ── Mi Perfil ────────────────────────────────────────────────────
function PerfilTab({ currentUser }: { currentUser: CurrentUser }) {
  const router = useRouter();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [phone, setPhone] = useState(currentUser?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!currentUser) {
    return <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-muted-foreground">No se pudo cargar tu sesión.</div>;
  }

  async function handleSave() {
    if (!currentUser) return;
    setSaving(true);
    setSaved(false);
    await updateMyProfile(currentUser.id, { name: name.trim(), phone: phone.trim() || null, avatarUrl: avatarUrl.trim() || null });
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0 overflow-hidden">
          {avatarUrl ? <img src={avatarUrl} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-gray-900">{currentUser.name}</p>
          <span className={cn("text-[10.5px] font-medium rounded-full px-2 py-0.5", ROLE_COLOR[currentUser.role] ?? "bg-gray-100 text-gray-600")}>
            {ROLE_LABEL[currentUser.role] ?? currentUser.role}
          </span>
        </div>
      </div>
      <div>
        <FieldLabel required>Nombre</FieldLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
      </div>
      <div>
        <FieldLabel>Correo</FieldLabel>
        <input value={currentUser.email} disabled className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] bg-gray-50 text-gray-400" />
        <p className="text-[11px] text-muted-foreground mt-1">El correo se administra desde tu cuenta de autenticación, no se puede editar aquí.</p>
      </div>
      <div>
        <FieldLabel>Teléfono</FieldLabel>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 809 555 5555" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
      </div>
      <div>
        <FieldLabel>URL de foto de perfil</FieldLabel>
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
      </div>
      <div className="flex justify-end pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-4 py-2 transition-colors disabled:opacity-50">
          {saved ? <><Check className="h-3.5 w-3.5" /> Guardado</> : saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

// ── Equipo ───────────────────────────────────────────────────────
function EquipoTab({ workspaceId, members, canManage }: { workspaceId: string; members: Member[]; canManage: boolean }) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function handleRoleChange(memberId: string, role: "ADMIN_DEALER" | "VENDEDOR") {
    await updateMemberRole(memberId, role);
    setOpenMenuId(null);
    router.refresh();
  }
  async function handleToggleActive(memberId: string, isActive: boolean) {
    await toggleMemberActive(memberId, isActive);
    setOpenMenuId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <button onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors">
            <Plus className="h-4 w-4" /> Invitar miembro
          </button>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {members.map((m) => (
          <div key={m.id} className={cn("flex items-center gap-3 px-4 py-3", !m.isActive && "opacity-50")}>
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-semibold shrink-0">
              {m.user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-900 truncate">{m.user.name}</p>
              <p className="text-[11.5px] text-muted-foreground truncate">{m.user.email}</p>
            </div>
            <span className={cn("text-[10.5px] font-medium rounded-full px-2 py-0.5 shrink-0", ROLE_COLOR[m.role] ?? "bg-gray-100 text-gray-600")}>
              {ROLE_LABEL[m.role] ?? m.role}
            </span>
            {!m.isActive && <span className="text-[10.5px] font-medium text-gray-400 shrink-0">Inactivo</span>}
            {canManage && m.role !== "SUPER_ADMIN" && (
              <div className="relative shrink-0">
                <button onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
                {openMenuId === m.id && (
                  <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44">
                    <button onClick={() => handleRoleChange(m.id, m.role === "ADMIN_DEALER" ? "VENDEDOR" : "ADMIN_DEALER")}
                      className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" /> {m.role === "ADMIN_DEALER" ? "Hacer Vendedor" : "Hacer Admin Dealer"}
                    </button>
                    <button onClick={() => handleToggleActive(m.id, !m.isActive)}
                      className="w-full text-left px-3 py-2 text-[12.5px] text-red-600 hover:bg-red-50">
                      {m.isActive ? "Desactivar" : "Reactivar"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {inviteOpen && <InviteModal workspaceId={workspaceId} onClose={() => setInviteOpen(false)} onInvited={() => { setInviteOpen(false); router.refresh(); }} />}
      </AnimatePresence>
    </div>
  );
}

function InviteModal({ workspaceId, onClose, onInvited }: { workspaceId: string; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN_DEALER" | "VENDEDOR">("VENDEDOR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleInvite() {
    if (!email.trim()) { setError("El correo es obligatorio."); return; }
    setSaving(true);
    setError("");
    try {
      await inviteTeamMember(workspaceId, email.trim(), name.trim(), role);
      onInvited();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo invitar al usuario.");
      setSaving(false);
    }
  }

  return (
    <ModalShell icon={Users} iconColor="text-primary" iconBg="bg-primary/10" title="Invitar miembro" subtitle="Se le enviará un correo de invitación" onClose={onClose}
      width={440}
      footer={<>
        <div />
        <div className="flex gap-2">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cancelar</button>
          <button onClick={handleInvite} disabled={saving}
            className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {saving ? "Invitando…" : "Invitar"}
          </button>
        </div>
      </>}>
      <div className="p-5 space-y-3">
        <div>
          <FieldLabel required>Correo</FieldLabel>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
        </div>
        <div>
          <FieldLabel>Nombre</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
        </div>
        <div>
          <FieldLabel>Rol</FieldLabel>
          <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN_DEALER" | "VENDEDOR")} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary bg-white">
            <option value="VENDEDOR">Vendedor</option>
            <option value="ADMIN_DEALER">Admin Dealer</option>
          </select>
        </div>
        {error && <p className="text-[11.5px] text-red-500">{error}</p>}
      </div>
    </ModalShell>
  );
}

// ── Contratos + Autorización de venta (Fase 2B) ─────────────────────
const TRIGGER_LABELS: Record<AuthorizationTrigger, string> = {
  BELOW_MINIMUM_PRICE: "Precio por debajo del mínimo",
  DISCOUNT_THRESHOLD: "Descuento mayor a un %",
  FINANCED_SALE: "Venta financiada",
  HIGH_VALUE: "Monto alto",
  MANUAL: "Manual",
};

function ContratosTab({ workspaceId, templates, rules }: { workspaceId: string; templates: ContractTemplateInfo[]; rules: AuthorizationRuleInfo[] }) {
  const router = useRouter();
  const [templateModal, setTemplateModal] = useState<ContractTemplateInfo | "new" | null>(null);
  const [ruleModal, setRuleModal] = useState<AuthorizationRuleInfo | "new" | null>(null);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Plantillas de contrato</p>
            <p className="text-[11.5px] text-muted-foreground">Placeholders: {"{{cliente.nombre}}"}, {"{{vehiculo.info}}"}, {"{{orden.numero}}"}, {"{{orden.precio}}"}, {"{{vendedor.nombre}}"}</p>
          </div>
          <button onClick={() => setTemplateModal("new")} className="flex items-center gap-1.5 text-[12.5px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3 py-1.5"><Plus className="h-3.5 w-3.5" /> Nueva plantilla</button>
        </div>
        <div className="divide-y divide-gray-100">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 truncate">{t.name}</p>
                <p className="text-[11px] text-muted-foreground">{t.documentType}</p>
              </div>
              {!t.isActive && <span className="text-[10.5px] text-gray-400">Inactiva</span>}
              <button onClick={() => setTemplateModal(t)} className="text-[11.5px] text-primary hover:underline">Editar</button>
              <button onClick={() => toggleContractTemplateActive(t.id, !t.isActive).then(() => router.refresh())} className="text-[11.5px] text-muted-foreground hover:underline">{t.isActive ? "Desactivar" : "Activar"}</button>
            </div>
          ))}
          {templates.length === 0 && <p className="text-[12px] text-muted-foreground py-2">Sin plantillas todavía.</p>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Reglas de autorización de venta</p>
            <p className="text-[11.5px] text-muted-foreground">Sin reglas activas, ninguna venta requiere autorización.</p>
          </div>
          <button onClick={() => setRuleModal("new")} className="flex items-center gap-1.5 text-[12.5px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3 py-1.5"><Plus className="h-3.5 w-3.5" /> Nueva regla</button>
        </div>
        <div className="divide-y divide-gray-100">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {TRIGGER_LABELS[r.trigger]}
                  {r.discountPercentThreshold != null && ` — umbral ${r.discountPercentThreshold}%`}
                  {r.amountThreshold != null && ` — umbral ${r.amountThreshold}`}
                </p>
              </div>
              {!r.isActive && <span className="text-[10.5px] text-gray-400">Inactiva</span>}
              <button onClick={() => setRuleModal(r)} className="text-[11.5px] text-primary hover:underline">Editar</button>
              <button onClick={() => toggleAuthorizationRuleActive(r.id, !r.isActive).then(() => router.refresh())} className="text-[11.5px] text-muted-foreground hover:underline">{r.isActive ? "Desactivar" : "Activar"}</button>
              <button onClick={() => { if (confirm(`¿Eliminar la regla "${r.name}"?`)) deleteAuthorizationRule(r.id).then(() => router.refresh()); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {rules.length === 0 && <p className="text-[12px] text-muted-foreground py-2">Sin reglas configuradas — ninguna venta requiere autorización hoy.</p>}
        </div>
      </div>

      <AnimatePresence>
        {templateModal && (
          <TemplateModal workspaceId={workspaceId} template={templateModal === "new" ? null : templateModal} onClose={() => setTemplateModal(null)} onSaved={() => { setTemplateModal(null); router.refresh(); }} />
        )}
        {ruleModal && (
          <RuleModal workspaceId={workspaceId} rule={ruleModal === "new" ? null : ruleModal} onClose={() => setRuleModal(null)} onSaved={() => { setRuleModal(null); router.refresh(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function TemplateModal({ workspaceId, template, onClose, onSaved }: { workspaceId: string; template: ContractTemplateInfo | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(template?.name ?? "");
  const [documentType, setDocumentType] = useState(template?.documentType ?? "contrato_compraventa");
  const [bodyTemplate, setBodyTemplate] = useState(template?.bodyTemplate ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !bodyTemplate.trim()) return;
    setSaving(true);
    if (template) await updateContractTemplate(template.id, { name, documentType, bodyTemplate });
    else await createContractTemplate(workspaceId, { name, documentType, bodyTemplate });
    setSaving(false); onSaved();
  }

  return (
    <ModalShell icon={FileSignature} iconColor="text-primary" iconBg="bg-primary/10" title={template ? "Editar plantilla" : "Nueva plantilla"} subtitle="Usa placeholders {{cliente.nombre}} etc." onClose={onClose} width={520}
      footer={<>
        <div />
        <div className="flex gap-2">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </>}>
      <div className="p-5 space-y-3">
        <div>
          <FieldLabel required>Nombre</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
        </div>
        <div>
          <FieldLabel>Tipo de documento</FieldLabel>
          <input value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
        </div>
        <div>
          <FieldLabel required>Contenido de la plantilla</FieldLabel>
          <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} rows={10}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary font-mono resize-none" />
        </div>
      </div>
    </ModalShell>
  );
}

function RuleModal({ workspaceId, rule, onClose, onSaved }: { workspaceId: string; rule: AuthorizationRuleInfo | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(rule?.name ?? "");
  const [trigger, setTrigger] = useState<AuthorizationTrigger>(rule?.trigger ?? "BELOW_MINIMUM_PRICE");
  const [discountPercentThreshold, setDiscountPercentThreshold] = useState(rule?.discountPercentThreshold != null ? String(rule.discountPercentThreshold) : "");
  const [amountThreshold, setAmountThreshold] = useState(rule?.amountThreshold != null ? String(rule.amountThreshold) : "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const data = {
      name, trigger,
      discountPercentThreshold: discountPercentThreshold ? Number(discountPercentThreshold) : null,
      amountThreshold: amountThreshold ? Number(amountThreshold) : null,
    };
    if (rule) await updateAuthorizationRule(rule.id, data);
    else await createAuthorizationRule(workspaceId, data);
    setSaving(false); onSaved();
  }

  return (
    <ModalShell icon={Shield} iconColor="text-primary" iconBg="bg-primary/10" title={rule ? "Editar regla" : "Nueva regla de autorización"} subtitle="Se evalúa cada vez que se intenta completar una venta" onClose={onClose} width={440}
      footer={<>
        <div />
        <div className="flex gap-2">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </>}>
      <div className="p-5 space-y-3">
        <div>
          <FieldLabel required>Nombre</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
        </div>
        <div>
          <FieldLabel required>Se dispara cuando</FieldLabel>
          <select value={trigger} onChange={(e) => setTrigger(e.target.value as AuthorizationTrigger)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary bg-white">
            {(Object.keys(TRIGGER_LABELS) as AuthorizationTrigger[]).filter((t) => t !== "MANUAL").map((t) => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
          </select>
        </div>
        {trigger === "DISCOUNT_THRESHOLD" && (
          <div>
            <FieldLabel>Umbral de descuento (%)</FieldLabel>
            <input type="number" value={discountPercentThreshold} onChange={(e) => setDiscountPercentThreshold(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </div>
        )}
        {trigger === "HIGH_VALUE" && (
          <div>
            <FieldLabel>Umbral de monto</FieldLabel>
            <input type="number" value={amountThreshold} onChange={(e) => setAmountThreshold(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </div>
        )}
      </div>
    </ModalShell>
  );
}
