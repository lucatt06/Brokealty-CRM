import { prisma } from "@/lib/prisma";
import type { Prisma, AutomationTrigger } from "@prisma/client";
import { executeTool, AUTOMATION_ACTION_TO_KEY } from "@/lib/actions/registry";
import { scheduleTask } from "./scheduled-tasks";

type LeadWithConversation = Prisma.LeadGetPayload<{ include: { conversations: true } }>;
export type AutomationWithActions = Prisma.AutomationGetPayload<{ include: { actions: true } }>;

function resolveWaitMs(config: Record<string, unknown>): number {
  // El builder de IA propone { hours: number } (ver PROPOSE_TOOL en app/actions/automations.ts).
  // También se acepta { value, unit } por si en el futuro se agrega un selector de unidad.
  if (typeof config.value === "number" && typeof config.unit === "string") {
    const perUnit = config.unit === "Minutes" ? 60_000 : config.unit === "Days" ? 86_400_000 : 3_600_000;
    return config.value * perUnit;
  }
  const hours = Number(config.hours) || 24;
  return hours * 60 * 60 * 1000;
}

/**
 * Ejecuta las acciones de una automatización en orden a partir de startIndex,
 * usando el registro de acciones compartido con el agente conversacional
 * (src/lib/actions/registry.ts). Al toparse con WAIT, programa un ScheduledTask
 * que retoma desde la siguiente acción y corta aquí — así una automatización
 * puede "pausarse" reusando la primitiva de la Fase A, sin un motor nuevo.
 */
export async function executeAutomationActions(
  automation: AutomationWithActions,
  startIndex: number,
  lead: LeadWithConversation,
  conversation: LeadWithConversation["conversations"][number] | undefined,
  workspaceId: string
) {
  const actions = [...automation.actions].sort((a, b) => a.order - b.order);

  for (let i = startIndex; i < actions.length; i++) {
    const action = actions[i];
    const config = (action.config ?? {}) as Record<string, unknown>;

    if (action.type === "WAIT") {
      await scheduleTask({
        workspaceId,
        type: "AUTOMATION_WAIT_RESUME",
        payload: {
          automationId: automation.id,
          leadId: lead.id,
          conversationId: conversation?.id ?? null,
          nextActionIndex: i + 1,
        },
        runAt: new Date(Date.now() + resolveWaitMs(config)),
      });
      return;
    }

    const key = AUTOMATION_ACTION_TO_KEY[action.type];
    if (!key) continue; // Tipo de acción desconocido — no-op explícito, no rompe la cadena.

    await executeTool(key, config, {
      workspaceId,
      leadId: lead.id,
      conversationId: conversation?.id ?? null,
      agentId: null,
      automationId: automation.id,
    });
  }
}

function matchesTriggerConfig(
  trigger: AutomationTrigger,
  triggerConfig: unknown,
  triggerContext?: Record<string, unknown>
): boolean {
  if (trigger !== "LEAD_STAGE_CHANGED") return true;
  const cfg = (triggerConfig ?? {}) as { toStage?: string };
  if (!cfg.toStage) return true; // sin filtro configurado -> dispara en cualquier cambio de etapa
  return cfg.toStage === (triggerContext?.toStage as string | undefined);
}

/**
 * Dispara todas las automatizaciones activas de un workspace para un trigger dado.
 * Punto de entrada único para los triggers basados en eventos (no en cron) —
 * se llama desde el código que ya hace la mutación real (crear lead, mover
 * etapa, agendar cita, cerrar negocio) en vez de tener un sistema de eventos
 * separado.
 */
export async function fireAutomationTrigger(
  workspaceId: string,
  trigger: AutomationTrigger,
  ctx: { leadId: string; conversationId?: string | null; triggerContext?: Record<string, unknown> }
) {
  const automations = await prisma.automation.findMany({
    where: { workspaceId, isActive: true, trigger },
    include: { actions: { orderBy: { order: "asc" } } },
  });
  if (!automations.length) return;

  const lead = await prisma.lead.findUnique({ where: { id: ctx.leadId }, include: { conversations: true } });
  if (!lead) return;

  for (const automation of automations) {
    if (!matchesTriggerConfig(automation.trigger, automation.triggerConfig, ctx.triggerContext)) continue;
    const conversation = ctx.conversationId
      ? lead.conversations.find((c) => c.id === ctx.conversationId)
      : lead.conversations[0];
    await executeAutomationActions(automation, 0, lead, conversation, workspaceId);
  }
}

/**
 * Corre las automatizaciones con trigger INACTIVITY: busca leads cuya conversación
 * más reciente no tuvo actividad en los últimos N días (configurados por automatización)
 * y ejecuta sus acciones. Deduplica vía un Activity marcador — cada automatización
 * dispara UNA sola vez por lead.
 */
export async function runInactivityAutomations() {
  const automations = await prisma.automation.findMany({
    where: { isActive: true, trigger: "INACTIVITY" },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  let leadsProcessed = 0;

  for (const automation of automations) {
    const days = Number((automation.triggerConfig as { days?: number })?.days) || 3;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const candidateLeads = await prisma.lead.findMany({
      where: {
        workspaceId: automation.workspaceId,
        conversations: { some: { lastMessageAt: { lt: cutoff } } },
      },
      include: { conversations: { orderBy: { lastMessageAt: "desc" }, take: 1 } },
    });

    for (const lead of candidateLeads) {
      const alreadyFired = await prisma.activity.findFirst({
        where: { leadId: lead.id, type: "AI_ACTION", metadata: { path: ["automationId"], equals: automation.id } },
      });
      if (alreadyFired) continue;

      const conversation = lead.conversations[0];
      await executeAutomationActions(automation, 0, lead, conversation, automation.workspaceId);

      await prisma.activity.create({
        data: {
          workspaceId: automation.workspaceId,
          leadId: lead.id,
          type: "AI_ACTION",
          description: `Automatización "${automation.name}" ejecutada por inactividad`,
          metadata: { automationId: automation.id },
        },
      });
      leadsProcessed++;
    }
  }

  return { automationsChecked: automations.length, leadsProcessed };
}

/**
 * Automatizaciones con trigger APPOINTMENT_REMINDER: dispara para citas dentro de
 * las próximas `triggerConfig.hoursBefore` horas (default 24) que todavía no
 * tienen recordatorio enviado. Reusa Appointment.reminderSent (ya existía en el
 * schema, sin usar hasta ahora) como marcador — una cita solo dispara un
 * recordatorio, aunque haya varias automatizaciones de este tipo activas.
 */
export async function runAppointmentReminders() {
  const automations = await prisma.automation.findMany({
    where: { isActive: true, trigger: "APPOINTMENT_REMINDER" },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  let appointmentsProcessed = 0;

  for (const automation of automations) {
    const hoursBefore = Number((automation.triggerConfig as { hoursBefore?: number })?.hoursBefore) || 24;
    const windowEnd = new Date(Date.now() + hoursBefore * 60 * 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        workspaceId: automation.workspaceId,
        status: { in: ["AGENDADA", "CONFIRMADA"] },
        reminderSent: false,
        startAt: { gte: new Date(), lte: windowEnd },
        leadId: { not: null },
      },
      include: { lead: { include: { conversations: true } } },
    });

    for (const appt of appointments) {
      if (!appt.lead) continue;
      await executeAutomationActions(automation, 0, appt.lead, appt.lead.conversations[0], automation.workspaceId);
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSent: true } });
      appointmentsProcessed++;
    }
  }

  return { automationsChecked: automations.length, appointmentsProcessed };
}

/**
 * Automatizaciones con trigger TASK_DUE: dispara para tareas pendientes cuya
 * fecha límite cae dentro de las próximas `triggerConfig.hoursBefore` horas
 * (default 0 = ya vencidas o vencen ahora). Usa Task.dueReminderSent como
 * marcador de dedup, mismo patrón que Appointment.reminderSent.
 */
export async function runTaskDueCheck() {
  const automations = await prisma.automation.findMany({
    where: { isActive: true, trigger: "TASK_DUE" },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  let tasksProcessed = 0;

  for (const automation of automations) {
    const hoursBefore = Number((automation.triggerConfig as { hoursBefore?: number })?.hoursBefore) || 0;
    const windowEnd = new Date(Date.now() + hoursBefore * 60 * 60 * 1000);

    const tasks = await prisma.task.findMany({
      where: {
        workspaceId: automation.workspaceId,
        status: { notIn: ["COMPLETADA", "CANCELADA"] },
        dueReminderSent: false,
        dueAt: { not: null, lte: windowEnd },
        leadId: { not: null },
      },
      include: { lead: { include: { conversations: true } } },
    });

    for (const task of tasks) {
      if (!task.lead) continue;
      await executeAutomationActions(automation, 0, task.lead, task.lead.conversations[0], automation.workspaceId);
      await prisma.task.update({ where: { id: task.id }, data: { dueReminderSent: true } });
      tasksProcessed++;
    }
  }

  return { automationsChecked: automations.length, tasksProcessed };
}
