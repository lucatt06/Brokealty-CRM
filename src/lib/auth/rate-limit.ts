import { headers } from "next/headers";

/**
 * Limitador en memoria (ventana deslizante) para login, registro y recuperación de contraseña.
 * Suficiente para UN solo servicio web en Railway; con varias réplicas cada una lleva su propio
 * contador (el límite efectivo se multiplica) y habría que moverlo a Redis.
 */
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return true;
}

/** IP del cliente tras el proxy de Railway (primer valor de x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
