/**
 * Nombres de contactos que vienen de una fuente automática (nombre de perfil de WhatsApp, etc.).
 * Un lead creado sin nombre usa su teléfono como nombre provisional; en cuanto la fuente trae un
 * nombre real, lo reemplazamos — pero NUNCA pisamos un nombre que alguien ya escribió a mano.
 */

const INVISIBLE = new RegExp("[\\u0000-\\u001F\\u007F\\u200B-\\u200F\\u2028-\\u202E\\u2060-\\u206F\\uFEFF]", "g");

/** Limpia un nombre externo: sin caracteres de control/invisibles, espacios colapsados, máx. 80. */
export function cleanDisplayName(raw: string | null | undefined): string {
  return (raw ?? "").replace(INVISIBLE, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** "Carlos Mejía" → { firstName: "Carlos", lastName: "Mejía" }; un solo token queda como nombre. */
export function splitDisplayName(raw: string | null | undefined): { firstName: string; lastName: string | null } | null {
  const name = cleanDisplayName(raw);
  if (!name) return null;
  // Un "nombre" que es solo un número de teléfono no aporta nada.
  if (/^[+\d\s().-]{6,}$/.test(name)) return null;
  const [first, ...rest] = name.split(" ");
  return { firstName: first, lastName: rest.length ? rest.join(" ") : null };
}

/** ¿El lead todavía tiene el teléfono como nombre (o un número cualquiera)? */
export function hasPlaceholderName(lead: { firstName: string; lastName: string | null; phone: string }): boolean {
  if (lead.lastName) return false;
  const first = lead.firstName.trim();
  const digits = (s: string) => s.replace(/\D/g, "");
  return first === lead.phone || /^[+\d\s().-]{6,}$/.test(first) || (digits(first).length >= 6 && digits(first) === digits(lead.phone));
}
