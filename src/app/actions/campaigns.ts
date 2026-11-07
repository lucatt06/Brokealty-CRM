"use server";

import { assertOwns, assertWorkspace, requireAdminCtx } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type CampaignType = "BROADCAST" | "SEQUENCE" | "TRIGGER";
export type CampaignStatus = "BORRADOR" | "PROGRAMADA" | "ENVIANDO" | "COMPLETADA" | "PAUSADA" | "CANCELADA";
export type CampaignChannel = "WHATSAPP" | "WHATSAPP_PERSONAL" | "FACEBOOK" | "INSTAGRAM" | "SMS" | "EMAIL";

export async function listCampaigns(workspaceId: string) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  const rows = await prisma.campaign.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((c) => ({
    ...c,
    scheduledAt: c.scheduledAt?.toISOString() ?? null,
    sentAt: c.sentAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export async function createCampaign(workspaceId: string, data: {
  name: string; type: CampaignType; channel: CampaignChannel; subject: string | null; content: string; scheduledAt: string | null;
}) {
  const ctx = await requireAdminCtx();
  assertWorkspace(ctx, workspaceId);
  await prisma.campaign.create({
    data: {
      workspaceId,
      name: data.name,
      type: data.type,
      channel: data.channel,
      subject: data.subject,
      content: data.content,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      status: data.scheduledAt ? "PROGRAMADA" : "BORRADOR",
    },
  });
  revalidatePath("/campanas");
}

export async function updateCampaign(id: string, data: {
  name: string; type: CampaignType; channel: CampaignChannel; subject: string | null; content: string; scheduledAt: string | null;
}) {
  const ctx = await requireAdminCtx();
  await assertOwns("campaign", id, ctx.workspace.id);
  await prisma.campaign.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type,
      channel: data.channel,
      subject: data.subject,
      content: data.content,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    },
  });
  revalidatePath("/campanas");
}

export async function setCampaignStatus(id: string, status: Extract<CampaignStatus, "PAUSADA" | "PROGRAMADA" | "CANCELADA">) {
  const ctx = await requireAdminCtx();
  await assertOwns("campaign", id, ctx.workspace.id);
  await prisma.campaign.update({ where: { id }, data: { status } });
  revalidatePath("/campanas");
}

export async function deleteCampaign(id: string) {
  const ctx = await requireAdminCtx();
  await assertOwns("campaign", id, ctx.workspace.id);
  await prisma.campaign.delete({ where: { id } });
  revalidatePath("/campanas");
}
