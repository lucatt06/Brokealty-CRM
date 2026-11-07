"use server";

import { assertOwns, assertWorkspace, requireAdminCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type AiAgentStatus = "OFF" | "SUGGESTIVE" | "AUTO_PILOT";
type AgentChannel = "SMS" | "INSTAGRAM" | "FACEBOOK" | "CHAT_WIDGET" | "LIVE_CHAT" | "WHATSAPP";

export async function createAgent(workspaceId: string, name: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  const count = await prisma.aIAgent.count({ where: { workspaceId } });
  const agent = await prisma.aIAgent.create({
    data: {
      workspaceId,
      name,
      isPrimary: count === 0, // el primer agente del workspace se marca primary automáticamente
    },
  });
  revalidatePath("/agentes");
  return agent;
}

export async function updateAgentSettings(id: string, data: {
  name: string;
  status: AiAgentStatus;
  channels: AgentChannel[];
  businessName?: string | null;
  waitTimeValue: number;
  waitTimeUnit: string;
  respondToImages: boolean;
  respondToVoiceNotes: boolean;
  respondToPdfs: boolean;
  sleepOnManualMessage: boolean;
  sleepOnWorkflowMessage: boolean;
}) {
  const ctx = await requireAdminCtx();
  await assertOwns("agent", id, ctx.workspace.id);
  await prisma.aIAgent.update({
    where: { id },
    data: {
      name: data.name,
      status: data.status,
      channels: data.channels,
      businessName: data.businessName || null,
      waitTimeValue: data.waitTimeValue,
      waitTimeUnit: data.waitTimeUnit,
      respondToImages: data.respondToImages,
      respondToVoiceNotes: data.respondToVoiceNotes,
      respondToPdfs: data.respondToPdfs,
      sleepOnManualMessage: data.sleepOnManualMessage,
      sleepOnWorkflowMessage: data.sleepOnWorkflowMessage,
    },
  });
  revalidatePath("/agentes");
}

export async function updateAgentGoals(id: string, data: {
  model: string;
  personality?: string | null;
  goal?: string | null;
  additionalInfo?: string | null;
  actions: string[];
}) {
  const ctx = await requireAdminCtx();
  await assertOwns("agent", id, ctx.workspace.id);
  await prisma.aIAgent.update({
    where: { id },
    data: {
      model: data.model,
      personality: data.personality || null,
      goal: data.goal || null,
      additionalInfo: data.additionalInfo || null,
      actions: data.actions,
    },
  });
  revalidatePath("/agentes");
}

export async function setPrimaryAgent(id: string, workspaceId: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  await assertOwns("agent", id, workspaceId);
  await prisma.$transaction([
    prisma.aIAgent.updateMany({ where: { workspaceId }, data: { isPrimary: false } }),
    prisma.aIAgent.update({ where: { id }, data: { isPrimary: true } }),
  ]);
  revalidatePath("/agentes");
}

export async function updateAgentStatus(id: string, status: AiAgentStatus) {
  const ctx = await requireAdminCtx();
  await assertOwns("agent", id, ctx.workspace.id);
  await prisma.aIAgent.update({ where: { id }, data: { status } });
  revalidatePath("/agentes");
}

export async function duplicateAgent(id: string) {
  const ctx = await requireAdminCtx();
  await assertOwns("agent", id, ctx.workspace.id);
  const original = await prisma.aIAgent.findUnique({ where: { id } });
  if (!original) return null;
  const clone = await prisma.aIAgent.create({
    data: {
      workspaceId: original.workspaceId,
      name: `${original.name} (copia)`,
      isPrimary: false,
      status: "OFF",
      channels: original.channels,
      businessName: original.businessName,
      waitTimeValue: original.waitTimeValue,
      waitTimeUnit: original.waitTimeUnit,
      respondToImages: original.respondToImages,
      respondToVoiceNotes: original.respondToVoiceNotes,
      sleepOnManualMessage: original.sleepOnManualMessage,
      sleepOnWorkflowMessage: original.sleepOnWorkflowMessage,
      model: original.model,
      personality: original.personality,
      goal: original.goal,
      additionalInfo: original.additionalInfo,
      actions: original.actions,
    },
  });
  revalidatePath("/agentes");
  return clone;
}

export async function deleteAgent(id: string) {
  const ctx = await requireAdminCtx();
  await assertOwns("agent", id, ctx.workspace.id);
  await prisma.aIAgent.delete({ where: { id } });
  revalidatePath("/agentes");
}
