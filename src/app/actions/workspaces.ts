"use server";

import { defaultStageRows } from "@/lib/pipeline/default-stages";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace, ACTIVE_WORKSPACE_COOKIE } from "@/lib/auth/active-workspace";
import { logAuditEvent } from "@/lib/audit";

async function requireSuperAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx?.isSuperAdmin) throw new Error("Solo un Super Admin puede hacer esto.");
  return ctx;
}

const DIACRITICS_RANGE_START = 0x0300;
const DIACRITICS_RANGE_END = 0x036f;

function stripDiacritics(text: string) {
  return text
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < DIACRITICS_RANGE_START || code > DIACRITICS_RANGE_END;
    })
    .join("");
}

function slugify(name: string) {
  return stripDiacritics(name.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || "tenant";
  let slug = root;
  let i = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    i++;
    slug = `${root}-${i}`;
  }
  return slug;
}

// ── Cambiar de tenant (solo Super Admin) ────────────────────────

export async function switchActiveWorkspace(workspaceId: string) {
  const ctx = await getActiveWorkspace();
  if (!ctx?.isSuperAdmin) throw new Error("Solo un Super Admin puede cambiar de tenant.");

  const target = await prisma.workspace.findUnique({ where: { id: workspaceId } });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", path: "/" });

  await logAuditEvent({
    actorUserId: ctx.user.id, actorName: ctx.user.name,
    workspaceId, workspaceName: target?.name ?? null,
    action: "TENANT_SWITCHED",
  });

  revalidatePath("/", "layout");
}

// ── Crear tenant nuevo (vacío, con defaults) ────────────────────

export async function createTenant(name: string) {
  const ctx = await requireSuperAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre del tenant es obligatorio.");

  const slug = await uniqueSlug(trimmed);

  const workspace = await prisma.workspace.create({
    data: {
      name: trimmed,
      slug,
      currency: "DOP",
      timezone: "America/Santo_Domingo",
      plan: "STARTER",
      isActive: true,
      users: { create: { userId: ctx.user.id, role: "SUPER_ADMIN" } },
      pipelines: {
        create: {
          name: "Pipeline Principal",
          isDefault: true,
          order: 0,
          stages: { create: defaultStageRows() },
        },
      },
    },
  });

  await logAuditEvent({
    actorUserId: ctx.user.id, actorName: ctx.user.name,
    workspaceId: workspace.id, workspaceName: workspace.name,
    action: "TENANT_CREATED",
  });

  revalidatePath("/", "layout");
  return workspace;
}

// ── Duplicar tenant: clona configuración, NO datos de clientes ──

export async function duplicateTenant(sourceWorkspaceId: string, newName: string) {
  const ctx = await requireSuperAdmin();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("El nombre del nuevo tenant es obligatorio.");

  const source = await prisma.workspace.findUnique({
    where: { id: sourceWorkspaceId },
    include: {
      pipelines: { include: { stages: { orderBy: { order: "asc" } } } },
      tags: true,
      knowledgeBases: { include: { items: true } },
      agentTools: true,
      agents: true,
      automations: { include: { actions: { orderBy: { order: "asc" } } } },
    },
  });
  if (!source) throw new Error("Tenant de origen no encontrado.");

  const slug = await uniqueSlug(trimmed);

  await prisma.$transaction(async (tx) => {
    const newWorkspace = await tx.workspace.create({
      data: {
        name: trimmed,
        slug,
        logoUrl: source.logoUrl,
        currency: source.currency,
        timezone: source.timezone,
        plan: source.plan,
        isActive: true,
        users: { create: { userId: ctx.user.id, role: "SUPER_ADMIN" } },
      },
    });

    // Pipelines + Stages
    for (const pipeline of source.pipelines) {
      await tx.pipeline.create({
        data: {
          workspaceId: newWorkspace.id,
          name: pipeline.name,
          isDefault: pipeline.isDefault,
          order: pipeline.order,
          stages: {
            create: pipeline.stages.map((s) => ({
              name: s.name, order: s.order, color: s.color, probability: s.probability, rotDays: s.rotDays,
            })),
          },
        },
      });
    }
    if (source.pipelines.length === 0) {
      await tx.pipeline.create({
        data: { workspaceId: newWorkspace.id, name: "Pipeline Principal", isDefault: true, order: 0, stages: { create: defaultStageRows() } },
      });
    }

    // Tags
    const tagIdMap = new Map<string, string>();
    for (const tag of source.tags) {
      const newTag = await tx.tag.create({ data: { workspaceId: newWorkspace.id, name: tag.name, color: tag.color } });
      tagIdMap.set(tag.id, newTag.id);
    }

    // Knowledge Bases + items
    const kbIdMap = new Map<string, string>();
    for (const kb of source.knowledgeBases) {
      const newKb = await tx.knowledgeBase.create({
        data: { workspaceId: newWorkspace.id, name: kb.name, description: kb.description },
      });
      kbIdMap.set(kb.id, newKb.id);
      for (const item of kb.items) {
        await tx.knowledgeBaseItem.create({
          data: {
            knowledgeBaseId: newKb.id, type: item.type, title: item.title,
            content: item.content, sourceUrl: item.sourceUrl, fileUrl: item.fileUrl,
          },
        });
      }
    }

    // Agent Tools (built-in + custom)
    const toolIdMap = new Map<string, string>();
    for (const tool of source.agentTools) {
      const newTool = await tx.agentTool.create({
        data: {
          workspaceId: newWorkspace.id, key: tool.key, name: tool.name, description: tool.description,
          category: tool.category, method: tool.method, examplePrompt: tool.examplePrompt, isBuiltIn: tool.isBuiltIn,
        },
      });
      toolIdMap.set(tool.id, newTool.id);
    }

    // Agentes IA — remapea knowledgeBaseIds y assignedToolIds a los nuevos IDs
    for (const agent of source.agents) {
      await tx.aIAgent.create({
        data: {
          workspaceId: newWorkspace.id,
          name: agent.name,
          type: agent.type,
          isPrimary: agent.isPrimary,
          status: "OFF", // el nuevo tenant arranca con el agente apagado hasta que lo activen
          channels: agent.channels,
          businessName: agent.businessName,
          waitTimeValue: agent.waitTimeValue,
          waitTimeUnit: agent.waitTimeUnit,
          respondToImages: agent.respondToImages,
          respondToVoiceNotes: agent.respondToVoiceNotes,
          respondToPdfs: agent.respondToPdfs,
          sleepOnManualMessage: agent.sleepOnManualMessage,
          sleepOnWorkflowMessage: agent.sleepOnWorkflowMessage,
          model: agent.model,
          personality: agent.personality,
          goal: agent.goal,
          additionalInfo: agent.additionalInfo,
          actions: agent.actions,
          actionsConfig: agent.actionsConfig ?? {},
          conversationSummaryEnabled: agent.conversationSummaryEnabled,
          conversationSummaryConfig: agent.conversationSummaryConfig ?? {},
          assignedToolIds: agent.assignedToolIds.map((id) => toolIdMap.get(id)).filter((v): v is string => !!v),
          knowledgeBaseIds: agent.knowledgeBaseIds.map((id) => kbIdMap.get(id)).filter((v): v is string => !!v),
        },
      });
    }

    // Automatizaciones + acciones
    for (const automation of source.automations) {
      await tx.automation.create({
        data: {
          workspaceId: newWorkspace.id,
          name: automation.name,
          description: automation.description,
          isActive: automation.isActive,
          trigger: automation.trigger,
          triggerConfig: automation.triggerConfig ?? {},
          actions: {
            create: automation.actions.map((a) => ({ order: a.order, type: a.type, config: a.config ?? {} })),
          },
        },
      });
    }

    return newWorkspace;
  }, { timeout: 20000 });

  await logAuditEvent({
    actorUserId: ctx.user.id, actorName: ctx.user.name,
    workspaceId: sourceWorkspaceId, workspaceName: source.name,
    action: "TENANT_DUPLICATED",
    details: { newName: trimmed, newSlug: slug },
  });

  revalidatePath("/", "layout");
}

// ── Suspender / Reactivar tenant ────────────────────────────────

export async function setTenantActive(workspaceId: string, isActive: boolean) {
  const ctx = await requireSuperAdmin();
  const target = await prisma.workspace.update({ where: { id: workspaceId }, data: { isActive } });

  await logAuditEvent({
    actorUserId: ctx.user.id, actorName: ctx.user.name,
    workspaceId, workspaceName: target.name,
    action: isActive ? "TENANT_REACTIVATED" : "TENANT_SUSPENDED",
  });

  revalidatePath("/", "layout");
}

// ── Eliminar tenant (destructivo — requiere confirmar el nombre) ─

export async function deleteTenant(workspaceId: string, confirmName: string) {
  const ctx = await requireSuperAdmin();
  const target = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!target) throw new Error("Tenant no encontrado.");
  if (confirmName.trim() !== target.name) {
    throw new Error("El nombre no coincide. Escribe el nombre exacto del tenant para confirmar.");
  }

  await prisma.workspace.delete({ where: { id: workspaceId } });

  await logAuditEvent({
    actorUserId: ctx.user.id, actorName: ctx.user.name,
    workspaceId: null, workspaceName: target.name,
    action: "TENANT_DELETED",
    details: { deletedWorkspaceId: workspaceId },
  });

  // Si el tenant activo era el que se borró, la próxima resolución de sesión
  // cae automáticamente al primero disponible (ver getActiveWorkspace).
  revalidatePath("/", "layout");
}

// ── Cambiar plan ─────────────────────────────────────────────────

export async function updateTenantPlan(workspaceId: string, plan: "STARTER" | "PRO" | "ENTERPRISE") {
  const ctx = await requireSuperAdmin();
  const target = await prisma.workspace.update({ where: { id: workspaceId }, data: { plan } });

  await logAuditEvent({
    actorUserId: ctx.user.id, actorName: ctx.user.name,
    workspaceId, workspaceName: target.name,
    action: "PLAN_CHANGED",
    details: { newPlan: plan },
  });

  revalidatePath("/", "layout");
}
