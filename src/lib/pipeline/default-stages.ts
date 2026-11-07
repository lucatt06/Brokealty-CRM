/**
 * Embudo por defecto de una inmobiliaria nueva. Es la única definición: la usan el
 * registro (provision), la creación de workspaces y la UI de Leads. Cada workspace
 * puede editar sus etapas después; estos nombres solo son el punto de partida.
 */
export const DEFAULT_PIPELINE_STAGES = [
  { name: "Nuevo Lead",         color: "#3b82f6", probability: 5,  badge: "bg-blue-100 text-blue-700" },
  { name: "Reactivación",       color: "#64748b", probability: 5,  badge: "bg-slate-100 text-slate-700" },
  { name: "Contactado",         color: "#8b5cf6", probability: 15, badge: "bg-purple-100 text-purple-700" },
  { name: "No Responde",        color: "#9ca3af", probability: 10, badge: "bg-gray-100 text-gray-600" },
  { name: "Lead respondido",    color: "#06b6d4", probability: 30, badge: "bg-cyan-100 text-cyan-700" },
  { name: "Información Enviada", color: "#14b8a6", probability: 40, badge: "bg-teal-100 text-teal-700" },
  { name: "Reagendar cita",     color: "#eab308", probability: 45, badge: "bg-yellow-100 text-yellow-700" },
  { name: "Cita programada",    color: "#f97316", probability: 60, badge: "bg-orange-100 text-orange-700" },
  { name: "Seguimiento",        color: "#ec4899", probability: 65, badge: "bg-pink-100 text-pink-700" },
  { name: "Decisión de compra", color: "#ef4444", probability: 80, badge: "bg-red-100 text-red-700" },
  { name: "Cierre",             color: "#22c55e", probability: 95, badge: "bg-green-100 text-green-700" },
] as const;

/** Etapa donde entra todo lead nuevo (webhooks, formulario, API). */
export const ENTRY_STAGE_NAME = DEFAULT_PIPELINE_STAGES[0].name;

/** Filas listas para `stages: { create: ... }` de Prisma. */
export function defaultStageRows() {
  return DEFAULT_PIPELINE_STAGES.map((s, order) => ({ name: s.name, order, color: s.color, probability: s.probability }));
}

const BADGE_BY_NAME: Record<string, string> = Object.fromEntries(DEFAULT_PIPELINE_STAGES.map((s) => [s.name, s.badge]));

/** Clases de badge para una etapa; las renombradas por el usuario caen en gris. */
export function stageBadgeClass(name: string | null | undefined) {
  return (name && BADGE_BY_NAME[name]) || "bg-gray-100 text-gray-600";
}

export const STAGE_FILTER_OPTIONS = ["Todos", ...DEFAULT_PIPELINE_STAGES.map((s) => s.name)];
