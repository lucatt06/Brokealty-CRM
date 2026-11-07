"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth/session";
import { createUserWithWorkspace } from "@/lib/auth/provision";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { RESET_TOKEN_TTL_MS, appBaseUrl, createPasswordToken, hashToken, sendAuthEmail } from "@/lib/auth/tokens";

const MIN_PASSWORD_LENGTH = 8;

type ActionResult = { error?: string; ok?: true };

async function startSession(userId: string) {
  const token = await signSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.6wYwZ1Y0y3Qh3a3o0s0y8o0o0o0O";
const TOO_MANY = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

export async function login(email: string, password: string): Promise<ActionResult> {
  const ip = await clientIp();
  const cleanEmail = email.trim().toLowerCase();
  // Por correo (fuerza bruta a una cuenta) y por IP (barrido de cuentas).
  if (!rateLimit(`login:email:${cleanEmail}`, 8, 15 * 60_000) || !rateLimit(`login:ip:${ip}`, 30, 15 * 60_000)) {
    return { error: TOO_MANY };
  }
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Misma respuesta para usuario inexistente / sin contraseña / contraseña errónea.
  // Siempre se hace un bcrypt.compare (aunque el usuario no exista) para que el tiempo de respuesta no delate qué correos están registrados.
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH).then((ok) => ok && !!user?.passwordHash);
  if (!user || !valid) return { error: "Correo o contraseña incorrectos" };

  await startSession(user.id);
  return { ok: true };
}

export async function register(name: string, email: string, password: string): Promise<ActionResult> {
  if (!rateLimit(`register:ip:${await clientIp()}`, 5, 60 * 60_000)) return { error: TOO_MANY };
  // Tras el primer usuario (dueño de la plataforma) el registro público se puede cerrar con ALLOW_REGISTRATION=false.
  if (process.env.ALLOW_REGISTRATION === "false" && (await prisma.user.count()) > 0) {
    return { error: "El registro está cerrado. Pide una invitación a tu administrador." };
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim() || cleanEmail.split("@")[0] || "Usuario";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` };
  }
  if (await prisma.user.findUnique({ where: { email: cleanEmail } })) {
    return { error: "Ya existe una cuenta con ese correo" };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUserWithWorkspace({ email: cleanEmail, name: cleanName, passwordHash });
  await startSession(user.id);
  return { ok: true };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  if (!rateLimit(`reset:ip:${await clientIp()}`, 5, 60 * 60_000) || !rateLimit(`reset:email:${email.trim().toLowerCase()}`, 3, 60 * 60_000)) {
    return { error: TOO_MANY };
  }
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // No revelar si el correo existe.
  if (user) {
    const token = await createPasswordToken(user.id, RESET_TOKEN_TTL_MS);
    const link = `${appBaseUrl()}/reset-password?token=${token}`;
    await sendAuthEmail(
      user.email,
      "Restablece tu contraseña de Brokealty CRM",
      `<p>Hola ${user.name},</p><p>Haz clic para crear una nueva contraseña (válido por 1 hora):</p><p><a href="${link}">${link}</a></p><p>Si no lo solicitaste, ignora este correo.</p>`
    );
  }
  return { ok: true };
}

export async function resetPassword(token: string, password: string): Promise<ActionResult> {
  if (!rateLimit(`resetpw:ip:${await clientIp()}`, 10, 60 * 60_000)) return { error: TOO_MANY };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` };
  }
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "El enlace no es válido o ya venció. Solicita uno nuevo." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  await startSession(record.userId);
  return { ok: true };
}
