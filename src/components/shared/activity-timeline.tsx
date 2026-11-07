"use client";

import {
  ArrowRight, UserPlus, User, Star, MessageSquare, Bot, Send, MessageCircle,
  Phone, Calendar, CheckSquare, X, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// ── Constantes compartidas ───────────────────────────────
export const ACT_META: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
  LEAD_CREATED:           { Icon: UserPlus,      color: "text-gray-500",   bg: "bg-gray-100"   },
  LEAD_UPDATED:           { Icon: User,           color: "text-gray-500",   bg: "bg-gray-100"   },
  STAGE_CHANGED:          { Icon: ArrowRight,     color: "text-amber-600",  bg: "bg-amber-50"   },
  CALL_MADE:              { Icon: Phone,          color: "text-blue-600",   bg: "bg-blue-50"    },
  APPOINTMENT_CREATED:    { Icon: Calendar,       color: "text-purple-600", bg: "bg-purple-50"  },
  APPOINTMENT_COMPLETED:  { Icon: Calendar,       color: "text-green-600",  bg: "bg-green-50"   },
  DEAL_WON:               { Icon: Star,           color: "text-green-600",  bg: "bg-green-50"   },
  DEAL_LOST:              { Icon: X,              color: "text-red-500",    bg: "bg-red-50"     },
  TASK_COMPLETED:         { Icon: CheckSquare,    color: "text-green-600",  bg: "bg-green-50"   },
  NOTE_ADDED:             { Icon: MessageSquare,  color: "text-amber-600",  bg: "bg-amber-50"   },
  AI_ACTION:              { Icon: Bot,            color: "text-violet-600", bg: "bg-violet-50"  },
  MESSAGE_SENT:           { Icon: Send,           color: "text-blue-500",   bg: "bg-blue-50"    },
  MESSAGE_RECEIVED:       { Icon: MessageCircle,  color: "text-gray-500",   bg: "bg-gray-100"   },
};

export const ACT_TITLE: Record<string, string> = {
  LEAD_CREATED:          "Contacto creado",
  LEAD_UPDATED:          "Contacto actualizado",
  STAGE_CHANGED:         "Etapa cambiada",
  CALL_MADE:             "Llamada realizada",
  APPOINTMENT_CREATED:   "Cita programada",
  APPOINTMENT_COMPLETED: "Cita completada",
  DEAL_WON:              "Negocio ganado",
  DEAL_LOST:             "Negocio perdido",
  TASK_COMPLETED:        "Tarea completada",
  NOTE_ADDED:            "Nota añadida",
  AI_ACTION:             "Acción IA",
  MESSAGE_SENT:          "Mensaje enviado",
  MESSAGE_RECEIVED:      "Mensaje recibido",
};

// ── Cuerpo de la actividad según tipo ───────────────────
function ActivityBody({ type, description }: { type: string; description: string }) {
  if (type === "NOTE_ADDED") {
    return (
      <div className="mt-1.5 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2.5">
        <p className="text-[12px] text-amber-900 leading-relaxed whitespace-pre-wrap break-words">
          {description}
        </p>
      </div>
    );
  }

  if (type === "APPOINTMENT_CREATED") {
    return (
      <div className="mt-1.5 bg-purple-50 border border-purple-200/80 rounded-lg px-3 py-2.5">
        <p className="text-[12px] text-purple-900 leading-relaxed break-words">{description}</p>
      </div>
    );
  }

  if (type === "APPOINTMENT_COMPLETED") {
    return (
      <div className="mt-1.5 bg-green-50 border border-green-200/80 rounded-lg px-3 py-2.5">
        <p className="text-[12px] text-green-900 leading-relaxed break-words">{description}</p>
      </div>
    );
  }

  if (type === "TASK_COMPLETED") {
    return (
      <div className="mt-1.5 flex items-start gap-2 bg-green-50 border border-green-200/80 rounded-lg px-3 py-2.5">
        <CheckSquare className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
        <p className="text-[12px] text-green-900 leading-relaxed break-words">{description}</p>
      </div>
    );
  }

  if (type === "CALL_MADE") {
    return (
      <div className="mt-1.5 bg-blue-50 border border-blue-200/80 rounded-lg px-3 py-2.5">
        <p className="text-[12px] text-blue-900 leading-relaxed break-words">{description}</p>
      </div>
    );
  }

  if (type === "AI_ACTION") {
    return (
      <div className="mt-1.5 bg-violet-50 border border-violet-200/80 rounded-lg px-3 py-2.5">
        <p className="text-[12px] text-violet-900 leading-relaxed break-words">{description}</p>
      </div>
    );
  }

  // Default: texto muted para eventos de sistema
  return (
    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 break-words">
      {description}
    </p>
  );
}

// ── ActivityTimeline ─────────────────────────────────────
export type ActivityItem = {
  id: string;
  type: string;
  description: string;
  createdAt: string;
};

type Props = {
  activities: ActivityItem[];
  emptyIcon?: React.ElementType;
  emptyLabel?: string;
  animate?: boolean;
};

export function ActivityTimeline({
  activities,
  emptyIcon: EmptyIcon = FileText,
  emptyLabel = "Sin actividades aún",
  animate = false,
}: Props) {
  if (!activities.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground px-4 text-center">
        <EmptyIcon className="h-8 w-8 opacity-20" />
        <p className="text-xs">{emptyLabel}</p>
      </div>
    );
  }

  // Agrupar por fecha
  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const act of [...activities].reverse()) {
    const d = new Date(act.createdAt);
    const now = new Date();
    const label =
      d.toDateString() === now.toDateString()
        ? "Hoy"
        : d
            .toLocaleDateString("es-DO", { month: "short", day: "numeric", year: "numeric" })
            .toUpperCase();
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(act);
    else groups.push({ label, items: [act] });
  }

  return (
    <div className="p-3">
      {groups.map(({ label, items }) => (
        <div key={label} className="mb-4">
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2 px-1">
            {label}
          </p>
          <div className="relative">
            {items.map((act, i) => {
              const meta = ACT_META[act.type] ?? ACT_META.LEAD_UPDATED;
              const Icon = meta.Icon;
              const Wrapper = animate ? motion.div : "div";
              const wrapperProps = animate
                ? { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 }, transition: { delay: i * 0.03, duration: 0.15 } }
                : {};

              return (
                <Wrapper key={act.id} className="flex gap-2.5 relative" {...(wrapperProps as object)}>
                  {i < items.length - 1 && (
                    <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border z-0" />
                  )}
                  <div
                    className={cn(
                      "h-[18px] w-[18px] rounded-full flex items-center justify-center shrink-0 mt-0.5 z-10 ring-2 ring-white",
                      meta.bg,
                    )}
                  >
                    <Icon className={cn("h-2.5 w-2.5", meta.color)} />
                  </div>
                  <div className="flex-1 pb-3 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground leading-tight">
                      {ACT_TITLE[act.type] ?? act.type}
                    </p>
                    <ActivityBody type={act.type} description={act.description} />
                    <p className="text-[10px] text-muted-foreground/40 mt-1">
                      {new Date(act.createdAt).toLocaleTimeString("es-DO", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                  </div>
                </Wrapper>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
