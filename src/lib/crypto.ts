import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("Configura ENCRYPTION_KEY en .env.local para cifrar credenciales.");
  return crypto.createHash("sha256").update(secret).digest();
}

/** Cifra un texto (p.ej. una API key) para guardarlo en la base de datos. */
export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/** Descifra un valor previamente cifrado con encrypt(). */
export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Máscara para mostrar en UI sin exponer la key completa, p.ej. "sk-ant-••••••7f2a". */
export function maskSecret(plainText: string): string {
  if (plainText.length <= 8) return "••••••••";
  return `${plainText.slice(0, 6)}••••••${plainText.slice(-4)}`;
}
