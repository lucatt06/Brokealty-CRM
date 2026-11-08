export type Coords = { latitude: number; longitude: number };

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Extrae coordenadas de un enlace de Google Maps (…/@18.48,-69.93,…, ?q=18.48,-69.93, ?ll=, …!3d18.48!4d-69.93)
 * o de texto plano "18.4861, -69.9312". Devuelve null si no encuentra un par válido.
 */
export function parseCoords(text: string): Coords | null {
  const t = decodeURIComponent(text.trim());
  const patterns = [
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|query|destination)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && valid(Number(m[1]), Number(m[2]))) return { latitude: Number(m[1]), longitude: Number(m[2]) };
  }
  return null;
}

/** Enlaces cortos/largos de Google Maps que se pueden seguir en el servidor para leer la coordenada. */
export function isGoogleMapsHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "maps.app.goo.gl" || h === "goo.gl" || h === "g.co" || /(^|\.)google\.[a-z.]+$/.test(h);
  } catch {
    return false;
  }
}
