import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend/client";

export const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hora
export const INVITE_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function appBaseUrl() {
  return (process.env.APP_URL ?? process.env.WEBHOOK_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Crea un token de un solo uso (restablecer contraseña o aceptar invitación). Devuelve el token en claro. */
export async function createPasswordToken(userId: string, ttlMs: number) {
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

export async function sendAuthEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    // Sin proveedor de correo configurado no se puede entregar el enlace; se avisa en logs.
    console.error(`[auth] RESEND_API_KEY / EMAIL_FROM no configurados — no se envió "${subject}" a ${to}`);
    return;
  }
  await sendEmail({ apiKey, from, to, subject, html });
}

export async function sendInviteEmail(userId: string, email: string, name: string, workspaceName: string) {
  const token = await createPasswordToken(userId, INVITE_TOKEN_TTL_MS);
  const link = `${appBaseUrl()}/reset-password?token=${token}&invite=1`;
  await sendAuthEmail(
    email,
    `Te invitaron a ${workspaceName} en Brokealty CRM`,
    `<p>Hola ${name},</p><p>Te invitaron a unirte a <b>${workspaceName}</b> en Brokealty CRM. Crea tu contraseña aquí (válido por 7 días):</p><p><a href="${link}">${link}</a></p>`
  );
}
