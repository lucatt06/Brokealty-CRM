"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { AnimatePresence } from "framer-motion";
import { MessageCircle, Camera, Music2, MessageSquare, Mail, Calendar, BarChart3, Megaphone, Check, Loader2, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import {
  connectWhatsAppEvolution, getWhatsAppStatus, disconnectWhatsAppEvolution,
  saveAiApiKey, removeAiApiKey, saveResendConfig, removeResendConfig,
  removeGoogleCalendarConfig,
  type IntegrationSummary, type AiProvider,
} from "@/app/actions/integrations";
import { completeWhatsAppCloudSignup, removeWhatsAppCloudConfig } from "@/app/actions/whatsapp-cloud-oauth";
import { ModalShell } from "@/components/agentes/action-modals";

type FbLoginResponse = { authResponse?: { code?: string } };
declare global {
  interface Window {
    FB?: {
      init: (params: { appId?: string; version: string }) => void;
      login: (
        callback: (response: FbLoginResponse) => void,
        options: { config_id?: string; response_type: string; override_default_response_type: boolean; extras: Record<string, unknown> }
      ) => void;
    };
  }
}

const CHANNELS: { type: string; label: string; description: string; Icon: React.ElementType; color: string; implemented: boolean }[] = [
  { type: "WHATSAPP_EVOLUTION", label: "Evolution", description: "Conecta tu número de WhatsApp escaneando un QR (no oficial).", Icon: MessageCircle, color: "#25D366", implemented: true },
  { type: "WHATSAPP_CLOUD", label: "WhatsApp", description: "API oficial de Meta para WhatsApp Business, con coexistencia con la app.", Icon: MessageCircle, color: "#25D366", implemented: true },
  { type: "FACEBOOK", label: "Facebook Messenger", description: "Responde mensajes de tu página de Facebook.", Icon: MessageSquare, color: "#1877F2", implemented: false },
  { type: "INSTAGRAM", label: "Instagram Direct", description: "Responde DMs de tu cuenta de Instagram.", Icon: Camera, color: "#E1306C", implemented: false },
  { type: "TIKTOK", label: "TikTok", description: "Conecta tu cuenta de negocio de TikTok.", Icon: Music2, color: "#000000", implemented: false },
  { type: "TWILIO", label: "SMS (Twilio)", description: "Envía y recibe SMS con tus leads.", Icon: MessageSquare, color: "#f97316", implemented: false },
  { type: "RESEND", label: "Email (Resend)", description: "Envía correos transaccionales y de seguimiento.", Icon: Mail, color: "#6b7280", implemented: true },
  { type: "GOOGLE_CALENDAR", label: "Google Calendar", description: "Sincroniza tus citas con Google Calendar.", Icon: Calendar, color: "#4285F4", implemented: true },
  { type: "GOOGLE_ANALYTICS", label: "Google Analytics", description: "Métricas de tu sitio y campañas.", Icon: BarChart3, color: "#F9AB00", implemented: false },
  { type: "META_ADS", label: "Meta Ads", description: "Importa leads de tus anuncios de Facebook/Instagram.", Icon: Megaphone, color: "#0866FF", implemented: false },
];

const AI_PROVIDERS: { type: AiProvider; label: string; description: string; placeholder: string }[] = [
  { type: "ANTHROPIC", label: "Anthropic (Claude)", description: "Modelo usado por tus Agentes de IA para conversar con leads.", placeholder: "sk-ant-…" },
  { type: "OPENAI", label: "OpenAI", description: "Usado para embeddings y funciones auxiliares de IA.", placeholder: "sk-…" },
];

export function IntegracionesClient({ workspaceId, integrations }: { workspaceId: string; integrations: IntegrationSummary[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const byType = new Map(integrations.map((i) => [i.type, i]));

  const [qrModal, setQrModal] = useState<{ base64: string | null; pairingCode: string | null } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [keyModal, setKeyModal] = useState<AiProvider | null>(null);
  const [resendModal, setResendModal] = useState(false);

  useEffect(() => {
    const status = searchParams.get("google_calendar");
    if (!status) return;
    if (status === "error") alert("No se pudo conectar Google Calendar. Intenta de nuevo.");
    router.replace("/integraciones");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleConnectWhatsApp() {
    setConnecting(true);
    try {
      const result = await connectWhatsAppEvolution(workspaceId);
      setQrModal({ base64: result.qrBase64, pairingCode: result.pairingCode });
      pollUntilConnected();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo iniciar la conexión.");
    } finally {
      setConnecting(false);
    }
  }

  function pollUntilConnected() {
    setPolling(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const status = await getWhatsAppStatus(workspaceId);
      if (status.connected || attempts > 30) {
        clearInterval(interval);
        setPolling(false);
        if (status.connected) {
          setQrModal(null);
          router.refresh();
        }
      }
    }, 3000);
  }

  async function handleDisconnectWhatsApp() {
    if (!confirm("¿Desconectar WhatsApp? Tendrás que escanear el QR de nuevo para reconectar.")) return;
    await disconnectWhatsAppEvolution(workspaceId);
    router.refresh();
  }

  async function handleDisconnectResend() {
    if (!confirm("¿Desconectar Email? Se dejarán de enviar correos hasta que lo vuelvas a conectar.")) return;
    await removeResendConfig(workspaceId);
    router.refresh();
  }

  async function handleDisconnectGoogleCalendar() {
    if (!confirm("¿Desconectar Google Calendar? Tus citas nuevas dejarán de sincronizarse hasta que lo vuelvas a conectar.")) return;
    await removeGoogleCalendarConfig(workspaceId);
    router.refresh();
  }

  async function handleDisconnectWhatsAppCloud() {
    if (!confirm("¿Desconectar WhatsApp? Se dejarán de recibir y responder mensajes por este canal hasta que lo vuelvas a conectar.")) return;
    await removeWhatsAppCloudConfig(workspaceId);
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Integraciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Conecta tus canales y configura las claves de IA que consumirán tus agentes.</p>
        </div>

        {/* Canales */}
        <section>
          <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Canales de comunicación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CHANNELS.map((ch) => {
              const row = byType.get(ch.type);
              const connected =
                ch.type === "WHATSAPP_EVOLUTION" || ch.type === "GOOGLE_CALENDAR" ? !!row?.connected : !!row?.maskedValue;
              return (
                <div key={ch.type} className={cn("bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3", !ch.implemented && "opacity-60")}>
                  <div className="flex items-start justify-between">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${ch.color}1A` }}>
                      <ch.Icon className="h-[18px] w-[18px]" style={{ color: ch.color }} />
                    </div>
                    {connected ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Conectado
                      </span>
                    ) : !ch.implemented ? (
                      <span className="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Próximamente</span>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold text-gray-900">{ch.label}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{ch.description}</p>
                    {ch.type === "RESEND" && row?.fromEmail && <p className="text-[11.5px] font-mono text-gray-400 mt-1.5">{row.fromEmail}</p>}
                    {ch.type === "GOOGLE_CALENDAR" && row?.calendarEmail && <p className="text-[11.5px] font-mono text-gray-400 mt-1.5">{row.calendarEmail}</p>}
                    {ch.type === "WHATSAPP_CLOUD" && row?.whatsappCloudPhone && <p className="text-[11.5px] font-mono text-gray-400 mt-1.5">{row.whatsappCloudPhone}</p>}
                  </div>
                  {ch.implemented && ch.type === "WHATSAPP_EVOLUTION" && (
                    connected ? (
                      <button onClick={handleDisconnectWhatsApp}
                        className="text-[12.5px] font-medium text-red-600 hover:bg-red-50 rounded-md px-2.5 py-1.5 self-start transition-colors">
                        Desconectar
                      </button>
                    ) : (
                      <button onClick={handleConnectWhatsApp} disabled={connecting}
                        className="text-[12.5px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-2.5 py-1.5 self-start transition-colors disabled:opacity-50">
                        {connecting ? "Conectando…" : "Conectar"}
                      </button>
                    )
                  )}
                  {ch.implemented && ch.type === "RESEND" && (
                    <div className="flex gap-2">
                      <button onClick={() => setResendModal(true)}
                        className="text-[12.5px] font-medium text-primary hover:bg-primary/5 rounded-md px-2.5 py-1.5 transition-colors">
                        {connected ? "Actualizar" : "Conectar"}
                      </button>
                      {connected && (
                        <button onClick={handleDisconnectResend}
                          className="text-[12.5px] font-medium text-red-500 hover:bg-red-50 rounded-md px-2.5 py-1.5 transition-colors">
                          Desconectar
                        </button>
                      )}
                    </div>
                  )}
                  {ch.implemented && ch.type === "GOOGLE_CALENDAR" && (
                    <div className="flex gap-2">
                      <a href="/api/oauth/google-calendar/start"
                        className="text-[12.5px] font-medium text-primary hover:bg-primary/5 rounded-md px-2.5 py-1.5 transition-colors">
                        {connected ? "Reconectar" : "Conectar"}
                      </a>
                      {connected && (
                        <button onClick={handleDisconnectGoogleCalendar}
                          className="text-[12.5px] font-medium text-red-500 hover:bg-red-50 rounded-md px-2.5 py-1.5 transition-colors">
                          Desconectar
                        </button>
                      )}
                    </div>
                  )}
                  {ch.implemented && ch.type === "WHATSAPP_CLOUD" && (
                    connected ? (
                      <div className="flex gap-2">
                        <button onClick={handleDisconnectWhatsAppCloud}
                          className="text-[12.5px] font-medium text-red-600 hover:bg-red-50 rounded-md px-2.5 py-1.5 self-start transition-colors">
                          Desconectar
                        </button>
                      </div>
                    ) : (
                      <WhatsAppCloudConnectButton workspaceId={workspaceId} onConnected={() => router.refresh()} />
                    )
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* API Keys de IA */}
        <section>
          <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Claves de API — Inteligencia Artificial</h2>
          <p className="text-[12.5px] text-muted-foreground mb-3">
            Tus agentes de IA consumen estas keys directamente — los costos de tokens corren por tu cuenta, no por la de Brokealty CRM.
            Si no configuras una key propia, se usará una compartida con límites reducidos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AI_PROVIDERS.map((p) => {
              const row = byType.get(p.type);
              return (
                <div key={p.type} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      <KeyRound className="h-[18px] w-[18px] text-violet-600" />
                    </div>
                    {row?.maskedValue ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                        <Check className="h-3 w-3" /> Configurada
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold text-gray-900">{p.label}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{p.description}</p>
                    {row?.maskedValue && <p className="text-[11.5px] font-mono text-gray-400 mt-1.5">{row.maskedValue}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setKeyModal(p.type)}
                      className="text-[12.5px] font-medium text-primary hover:bg-primary/5 rounded-md px-2.5 py-1.5 transition-colors">
                      {row?.maskedValue ? "Actualizar" : "Agregar key"}
                    </button>
                    {row?.maskedValue && (
                      <button onClick={async () => { await removeAiApiKey(workspaceId, p.type); router.refresh(); }}
                        className="text-[12.5px] font-medium text-red-500 hover:bg-red-50 rounded-md px-2.5 py-1.5 transition-colors">
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {qrModal && (
          <QrModal base64={qrModal.base64} pairingCode={qrModal.pairingCode} polling={polling} onClose={() => setQrModal(null)} />
        )}
        {keyModal && (
          <AiKeyModal
            label={AI_PROVIDERS.find((p) => p.type === keyModal)!.label}
            placeholder={AI_PROVIDERS.find((p) => p.type === keyModal)!.placeholder}
            onClose={() => setKeyModal(null)}
            onSave={async (key) => { await saveAiApiKey(workspaceId, keyModal, key); setKeyModal(null); router.refresh(); }}
          />
        )}
        {resendModal && (
          <ResendModal
            initialFromEmail={byType.get("RESEND")?.fromEmail ?? ""}
            onClose={() => setResendModal(false)}
            onSave={async (apiKey, fromEmail) => { await saveResendConfig(workspaceId, apiKey, fromEmail); setResendModal(false); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function QrModal({ base64, polling, onClose }: { base64: string | null; pairingCode: string | null; polling: boolean; onClose: () => void }) {
  return (
    <ModalShell icon={MessageCircle} iconColor="text-green-600" iconBg="bg-green-50"
      title="Conectar WhatsApp" subtitle="Escanea el código con tu teléfono" onClose={onClose}
      width={420}
      footer={<div className="flex-1 flex items-center justify-center text-[12px] text-muted-foreground">
        {polling ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Esperando que escanees…</span> : "Cerrar cuando termines"}
      </div>}>
      <div className="p-6 flex flex-col items-center gap-4">
        {base64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={base64} alt="Código QR de WhatsApp" className="w-56 h-56 rounded-lg border border-gray-100" />
        ) : (
          <div className="w-56 h-56 rounded-lg border border-gray-100 flex items-center justify-center text-muted-foreground text-sm">
            No se pudo generar el QR
          </div>
        )}
        <ol className="text-[12.5px] text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Abre WhatsApp en tu teléfono</li>
          <li>Ve a Configuración → Dispositivos vinculados</li>
          <li>Toca &quot;Vincular un dispositivo&quot; y escanea este código</li>
        </ol>
      </div>
    </ModalShell>
  );
}

function AiKeyModal({ label, placeholder, onClose, onSave }: {
  label: string; placeholder: string; onClose: () => void; onSave: (key: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!value.trim()) { setError("La key no puede estar vacía."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(value.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la key.");
      setSaving(false);
    }
  }

  return (
    <ModalShell icon={KeyRound} iconColor="text-violet-600" iconBg="bg-violet-50"
      title={`Conectar ${label}`} subtitle="Esta key será usada por tus agentes de IA" onClose={onClose}
      width={480}
      footer={<>
        <div />
        <div className="flex gap-2">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </>}>
      <div className="p-5 space-y-2">
        <label className="text-[12px] font-semibold text-gray-700 block">API Key</label>
        <input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder}
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] font-mono outline-none focus:border-primary" />
        {error && <p className="text-[11.5px] text-red-500">{error}</p>}
        <p className="text-[11.5px] text-muted-foreground pt-1">
          Se guarda cifrada. Nunca se muestra completa después de guardarla.
        </p>
      </div>
    </ModalShell>
  );
}

function ResendModal({ initialFromEmail, onClose, onSave }: {
  initialFromEmail: string; onClose: () => void; onSave: (apiKey: string, fromEmail: string) => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(initialFromEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!apiKey.trim()) { setError("La API key no puede estar vacía."); return; }
    if (!fromEmail.trim()) { setError("El correo remitente no puede estar vacío."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(apiKey.trim(), fromEmail.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la configuración.");
      setSaving(false);
    }
  }

  return (
    <ModalShell icon={Mail} iconColor="text-gray-600" iconBg="bg-gray-100"
      title="Conectar Email (Resend)" subtitle="Se usará para responder a leads y para follow-ups" onClose={onClose}
      width={480}
      footer={<>
        <div />
        <div className="flex gap-2">
          <button onClick={onClose} className="text-[13px] font-medium text-gray-500 hover:bg-gray-100 rounded-md px-3.5 py-2 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-3.5 py-2 transition-colors disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </>}>
      <div className="p-5 space-y-3">
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">API Key de Resend</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="re_…"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] font-mono outline-none focus:border-primary" />
        </div>
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-gray-700 block">Correo remitente</label>
          <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="ventas@tudealer.com"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          <p className="text-[11px] text-muted-foreground">Debe ser un dominio verificado en tu cuenta de Resend.</p>
        </div>
        {error && <p className="text-[11.5px] text-red-500">{error}</p>}
        <p className="text-[11.5px] text-muted-foreground pt-1">
          La API key se guarda cifrada. Nunca se muestra completa después de guardarla.
        </p>
      </div>
    </ModalShell>
  );
}

function WhatsAppCloudConnectButton({ workspaceId, onConnected }: { workspaceId: string; onConnected: () => void }) {
  const [sdkReady, setSdkReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  // El code que devuelve FB.login no trae phone_number_id/waba_id — Meta los manda
  // aparte por postMessage durante el flujo de Embedded Signup, así que se capturan
  // en un ref y se combinan con el code cuando el callback de FB.login llega.
  const signupDataRef = useRef<{ phoneNumberId?: string; wabaId?: string }>({});

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.includes("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.event === "FINISH") {
          signupDataRef.current = { phoneNumberId: data.data?.phone_number_id, wabaId: data.data?.waba_id };
        }
      } catch {
        // Mensajes que no son JSON del flujo de Embedded Signup se ignoran.
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function processLoginResponse(response: FbLoginResponse) {
    const code = response.authResponse?.code;
    const { phoneNumberId, wabaId } = signupDataRef.current;
    if (!code || !phoneNumberId || !wabaId) {
      setConnecting(false);
      return; // El usuario cerró el popup o no completó el flujo — no es un error a mostrar.
    }
    try {
      await completeWhatsAppCloudSignup(workspaceId, { code, phoneNumberId, wabaId });
      onConnected();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo conectar WhatsApp.");
    } finally {
      setConnecting(false);
    }
  }

  function handleConnect() {
    if (!window.FB) return;
    setConnecting(true);
    signupDataRef.current = {};
    // El callback de FB.login() NO puede ser una función async — el SDK de Meta valida
    // internamente que sea una función plana y rechaza AsyncFunction con un error críptico
    // ("Expression is of type asyncfunction, not function"). La parte async se delega aparte.
    window.FB.login(
      (response) => {
        void processLoginResponse(response);
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { sessionInfoVersion: "3" },
      }
    );
  }

  return (
    <>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.FB?.init({ appId: process.env.NEXT_PUBLIC_META_APP_ID, version: "v21.0" });
          setSdkReady(true);
        }}
      />
      <button onClick={handleConnect} disabled={connecting || !sdkReady}
        className="text-[12.5px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-2.5 py-1.5 self-start transition-colors disabled:opacity-50">
        {connecting ? "Conectando…" : "Conectar con Facebook"}
      </button>
    </>
  );
}
