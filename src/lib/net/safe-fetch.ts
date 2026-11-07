import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Protección SSRF para peticiones salientes a URLs que escribe el usuario.
 * Bloquea direcciones privadas, loopback, link-local (metadatos de nube), CGNAT y
 * redes internas de Railway (*.railway.internal), y revalida cada redirección.
 */

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string) {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIPv4(mapped[1]) : false;
}

export class UnsafeUrlError extends Error {}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Enlace no válido.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Solo se permiten enlaces http o https.");
  if (url.username || url.password) throw new UnsafeUrlError("Enlace no permitido.");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".internal") || host.endsWith(".local")) throw new UnsafeUrlError("Enlace no permitido.");

  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  if (!addresses.length) throw new UnsafeUrlError("No se pudo resolver el enlace.");
  for (const { address, family } of addresses) {
    if (family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address)) throw new UnsafeUrlError("Enlace no permitido.");
  }
  return url;
}

/** fetch con validación SSRF en cada salto (máx. 3 redirecciones), timeout y tope de tamaño. */
export async function safeFetch(raw: string, opts: { timeoutMs?: number; headers?: Record<string, string> } = {}): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop <= 3; hop++) {
    const url = await assertPublicHttpUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      headers: opts.headers,
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError("Demasiadas redirecciones.");
}

/** Lee el cuerpo como texto con un tope de bytes (evita agotar memoria con respuestas enormes). */
export async function readTextCapped(res: Response, maxBytes = 1_000_000): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, maxBytes));
}
