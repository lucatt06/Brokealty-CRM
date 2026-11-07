"use server";

import { assertWorkspace, requireAdminCtx } from "@/lib/auth/guards";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { encrypt } from "@/lib/crypto";
import {
  exchangeCodeForToken, subscribeAppToWaba, registerPhoneNumber, getPhoneNumberInfo,
} from "@/lib/whatsapp-cloud/graph-client";

function generatePin(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Completa el Embedded Signup: intercambia el código del popup de Meta por un
 * access token, suscribe la App a los webhooks de la WABA, registra el número
 * para mensajería Cloud API, y guarda la integración del workspace.
 */
export async function completeWhatsAppCloudSignup(
  workspaceId: string,
  params: { code: string; phoneNumberId: string; wabaId: string }
) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  const { code, phoneNumberId, wabaId } = params;
  if (!code || !phoneNumberId || !wabaId) throw new Error("Faltan datos del popup de Meta para completar la conexión.");

  const { accessToken } = await exchangeCodeForToken(code);
  await subscribeAppToWaba(wabaId, accessToken);

  const pin = generatePin();
  await registerPhoneNumber(phoneNumberId, accessToken, pin).catch((err) => {
    // Un número ya registrado (reconexión) responde con error — no es fatal, seguimos.
    console.warn("registerPhoneNumber:", err instanceof Error ? err.message : err);
  });

  const info = await getPhoneNumberInfo(phoneNumberId, accessToken).catch(() => null);

  const webhookBase = process.env.WEBHOOK_BASE_URL;
  const webhookUrl = webhookBase ? `${webhookBase}/api/webhooks/whatsapp-cloud` : null;

  await prisma.integration.upsert({
    where: { workspaceId_type: { workspaceId, type: "WHATSAPP_CLOUD" } },
    create: {
      workspaceId,
      type: "WHATSAPP_CLOUD",
      name: "WhatsApp (oficial)",
      isActive: true,
      config: {
        phoneNumberId, wabaId,
        encryptedAccessToken: encrypt(accessToken),
        encryptedPin: encrypt(pin),
        displayPhoneNumber: info?.display_phone_number ?? null,
      },
      webhookUrl,
    },
    update: {
      isActive: true,
      config: {
        phoneNumberId, wabaId,
        encryptedAccessToken: encrypt(accessToken),
        encryptedPin: encrypt(pin),
        displayPhoneNumber: info?.display_phone_number ?? null,
      },
      webhookUrl,
    },
  });

  revalidatePath("/integraciones");
  return { displayPhoneNumber: info?.display_phone_number ?? null };
}

export async function removeWhatsAppCloudConfig(workspaceId: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  await prisma.integration.deleteMany({ where: { workspaceId, type: "WHATSAPP_CLOUD" } });
  revalidatePath("/integraciones");
}
