import crypto from "crypto";

/**
 * Verifica que un POST al webhook realmente vino de Meta, comparando el HMAC-SHA256
 * del body crudo (firmado con el App Secret) contra el header X-Hub-Signature-256.
 * Sin esto, cualquiera que adivine la URL podría inyectar mensajes falsos que el
 * bot procesaría como si vinieran de un cliente real.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.replace(/^sha256=/, "");

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(received, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
