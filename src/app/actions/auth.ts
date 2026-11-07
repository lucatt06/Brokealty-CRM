"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth/session";
import { createUserWithWorkspace } from "@/lib/auth/provision";
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

export async function login(email: string, password: string): Promise<ActionResult> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Misma respuesta para usuario inexistente / sin contraseña / contraseña errónea.
  const valid = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) return { error: "Correo o contraseña incorrectos" };

  await startSession(user.id);
  return { ok: true };
}

export async function register(name: string, email: string, password: string): Promise<ActionResult> {
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
