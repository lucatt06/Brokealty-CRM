/**
 * Bro siempre usa el modelo más económico de la familia (Haiku): es un chat de uso frecuente con mucho contexto.
 * Se puede cambiar con la variable BRO_MODEL (p. ej. si un día Anthropic saca uno más barato) sin tocar código.
 */
export const BRO_MODEL = process.env.BRO_MODEL || "claude-haiku-5-5";
