"use server";

import { AuthError, assertWorkspace, requireAdminCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { encrypt, decrypt, maskSecret } from "@/lib/crypto";
import { EVOLUTION_WEBHOOK_VERSION } from "@/lib/evolution/sync-webhooks";
import { createInstance, connectInstance, fetchConnectionState, deleteInstance, setInstanceWebhook } from "@/lib/evolution/client";

export type AiProvider = "OPENAI" | "ANTHROPIC";

type EvolutionConfig = { instanceName?: string; connected?: boolean; lastState?: string };
type AiKeyConfig = { encryptedKey?: string };
type ResendConfig = { encryptedKey?: string; fromEmail?: string };
type GoogleCalendarConfig = { email?: string };
type WhatsAppCloudConfig = { displayPhoneNumber?: string | null };

export type IntegrationSummary = {
  id: string;
  type: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
  maskedValue: string | null;
  connected: boolean | null;
  instanceName: string | null;
  fromEmail: string | null;
  calendarEmail: string | null;
  whatsappCloudPhone: string | null;
};

export async function listIntegrations(workspaceId: string): Promise<IntegrationSummary[]> {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  const rows = await prisma.integration.findMany({ where: { workspaceId } });
  return rows.map((r) => {
    let maskedValue: string | null = null;
    let connected: boolean | null = null;
    let instanceName: string | null = null;
    let fromEmail: string | null = null;
    let calendarEmail: string | null = null;
    let whatsappCloudPhone: string | null = null;

    if (r.type === "OPENAI" || r.type === "ANTHROPIC") {
      const config = r.config as AiKeyConfig;
      if (config.encryptedKey) {
        try { maskedValue = maskSecret(decrypt(config.encryptedKey)); } catch { maskedValue = "••••••••"; }
      }
    }
    if (r.type === "WHATSAPP_EVOLUTION") {
      const config = r.config as EvolutionConfig;
      connected = config.connected ?? false;
      instanceName = config.instanceName ?? null;
    }
    if (r.type === "RESEND") {
      const config = r.config as ResendConfig;
      fromEmail = config.fromEmail ?? null;
      if (config.encryptedKey) {
        try { maskedValue = maskSecret(decrypt(config.encryptedKey)); } catch { maskedValue = "••••••••"; }
      }
    }
    if (r.type === "GOOGLE_CALENDAR") {
      const config = r.config as GoogleCalendarConfig;
      calendarEmail = config.email ?? null;
      connected = r.isActive;
    }
    if (r.type === "WHATSAPP_CLOUD") {
      const config = r.config as WhatsAppCloudConfig;
      whatsappCloudPhone = config.displayPhoneNumber ?? null;
      connected = r.isActive;
    }

    return {
      id: r.id, type: r.type, name: r.name, isActive: r.isActive,
      updatedAt: r.updatedAt.toISOString(),
      maskedValue, connected, instanceName, fromEmail, calendarEmail, whatsappCloudPhone,
    };
  });
}

// ── API Keys de IA (multi-tenant: cada workspace paga sus propios tokens) ──

export async function saveAiApiKey(workspaceId: string, provider: AiProvider, apiKey: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  if (provider !== "OPENAI" && provider !== "ANTHROPIC") throw new AuthError("Proveedor no válido.");
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("La API key no puede estar vacía.");

  await prisma.integration.upsert({
    where: { workspaceId_type: { workspaceId, type: provider } },
    create: {
      workspaceId,
      type: provider,
      name: provider === "OPENAI" ? "OpenAI" : "Anthropic (Claude)",
      isActive: true,
      config: { encryptedKey: encrypt(trimmed) },
    },
    update: { isActive: true, config: { encryptedKey: encrypt(trimmed) } },
  });
  revalidatePath("/integraciones");
}

export async function removeAiApiKey(workspaceId: string, provider: AiProvider) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  if (provider !== "OPENAI" && provider !== "ANTHROPIC") throw new AuthError("Proveedor no válido.");
  await prisma.integration.deleteMany({ where: { workspaceId, type: provider } });
  revalidatePath("/integraciones");
}

// ── Email (Resend) ──────────────────────────────────────────────────────

export async function saveResendConfig(workspaceId: string, apiKey: string, fromEmail: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  const trimmedKey = apiKey.trim();
  const trimmedFrom = fromEmail.trim();
  if (!trimmedKey) throw new Error("La API key no puede estar vacía.");
  if (!trimmedFrom) throw new Error("El correo remitente no puede estar vacío.");

  await prisma.integration.upsert({
    where: { workspaceId_type: { workspaceId, type: "RESEND" } },
    create: {
      workspaceId,
      type: "RESEND",
      name: "Email (Resend)",
      isActive: true,
      config: { encryptedKey: encrypt(trimmedKey), fromEmail: trimmedFrom },
    },
    update: { isActive: true, config: { encryptedKey: encrypt(trimmedKey), fromEmail: trimmedFrom } },
  });
  revalidatePath("/integraciones");
}

export async function removeResendConfig(workspaceId: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  await prisma.integration.deleteMany({ where: { workspaceId, type: "RESEND" } });
  revalidatePath("/integraciones");
}

// ── Google Calendar ─────────────────────────────────────────────────────

export async function removeGoogleCalendarConfig(workspaceId: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  await prisma.integration.deleteMany({ where: { workspaceId, type: "GOOGLE_CALENDAR" } });
  revalidatePath("/integraciones");
}

// ── WhatsApp (Evolution API) ────────────────────────────────────────────

export async function connectWhatsAppEvolution(workspaceId: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new Error("Workspace no encontrado.");

  const webhookBase = process.env.WEBHOOK_BASE_URL;
  if (!webhookBase) throw new Error("Configura WEBHOOK_BASE_URL en .env.local antes de conectar un canal.");
  const webhookUrl = `${webhookBase}/api/webhooks/evolution`;

  const existing = await prisma.integration.findFirst({ where: { workspaceId, type: "WHATSAPP_EVOLUTION" } });
  const existingConfig = existing?.config as EvolutionConfig | undefined;
  const instanceName = existingConfig?.instanceName ?? `${workspace.slug}-${workspace.id.slice(-6)}`;

  const qr = existingConfig?.instanceName
    ? await connectInstance(instanceName).catch(() => createInstance(instanceName, webhookUrl))
    : await createInstance(instanceName, webhookUrl);
  // Reafirma el webhook (con su firma) también en instancias que ya existían.
  if (existingConfig?.instanceName) await setInstanceWebhook(instanceName, webhookUrl);

  await prisma.integration.upsert({
    where: { workspaceId_type: { workspaceId, type: "WHATSAPP_EVOLUTION" } },
    create: {
      workspaceId,
      type: "WHATSAPP_EVOLUTION",
      name: "WhatsApp (Evolution API)",
      isActive: false,
      config: { instanceName, connected: false, webhookVersion: EVOLUTION_WEBHOOK_VERSION },
      webhookUrl,
    },
    update: { webhookUrl },
  });

  revalidatePath("/integraciones");
  return { qrBase64: qr.base64 ?? null, pairingCode: qr.pairingCode ?? null };
}

export async function getWhatsAppStatus(workspaceId: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  const integration = await prisma.integration.findFirst({ where: { workspaceId, type: "WHATSAPP_EVOLUTION" } });
  if (!integration) return { connected: false, instanceName: null as string | null };

  const config = integration.config as EvolutionConfig;
  const instanceName = config.instanceName ?? null;
  if (!instanceName) return { connected: false, instanceName };

  try {
    const state = await fetchConnectionState(instanceName);
    const connected = state.instance.state === "open";
    if (connected !== config.connected) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: { isActive: connected, config: { ...config, connected } },
      });
    }
    return { connected, instanceName };
  } catch {
    return { connected: false, instanceName };
  }
}

export async function disconnectWhatsAppEvolution(workspaceId: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  const integration = await prisma.integration.findFirst({ where: { workspaceId, type: "WHATSAPP_EVOLUTION" } });
  if (!integration) return;

  const config = integration.config as EvolutionConfig;
  if (config.instanceName) await deleteInstance(config.instanceName).catch(() => {});
  await prisma.integration.delete({ where: { id: integration.id } });
  revalidatePath("/integraciones");
}
