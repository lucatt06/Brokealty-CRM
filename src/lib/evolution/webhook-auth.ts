import crypto from "crypto";

/**
 * Autenticación del webhook de Evolution API. Evolution no firma el body, pero permite
 * configurar headers fijos por instancia: enviamos HMAC-SHA256(secreto, instanceName) y el
 * webhook lo recalcula. Así solo quien conozca EVOLUTION_WEBHOOK_SECRET puede inyectar
 * mensajes, y el valor de una instancia no sirve para otra. Sin secreto configurado el
 * webhook rechaza todo (falla cerrado).
 */
export const EVOLUTION_SIGNATURE_HEADER = "x-brokealty-signature";

function signature(instanceName: string): string | null {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(instanceName).digest("hex");
}

export function webhookHeadersFor(instanceName: string): Record<string, string> {
  const sig = signature(instanceName);
  if (!sig) throw new Error("Configura EVOLUTION_WEBHOOK_SECRET antes de conectar WhatsApp (Evolution).");
  return { [EVOLUTION_SIGNATURE_HEADER]: sig };
}

export function verifyEvolutionWebhook(instanceName: string | undefined, received: string | null): boolean {
  if (!instanceName || !received) return false;
  const expected = signature(instanceName);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
