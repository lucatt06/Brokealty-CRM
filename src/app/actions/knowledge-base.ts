"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type KnowledgeItemType = "TEXTO" | "PREGUNTA_FRECUENTE" | "ARCHIVO" | "URL" | "TABLA";

// ── Bases de conocimiento ──────────────────────────────────
export async function listKnowledgeBases(workspaceId: string) {
  const bases = await prisma.knowledgeBase.findMany({
    where: { workspaceId },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  return bases;
}

export async function createKnowledgeBase(workspaceId: string, name: string) {
  const kb = await prisma.knowledgeBase.create({ data: { workspaceId, name } });
  revalidatePath("/agentes");
  return kb;
}

export async function renameKnowledgeBase(id: string, name: string) {
  await prisma.knowledgeBase.update({ where: { id }, data: { name } });
  revalidatePath("/agentes");
}

export async function deleteKnowledgeBase(id: string) {
  await prisma.knowledgeBase.delete({ where: { id } });
  // Desvincular de cualquier agente que la tuviera adjunta
  const agents = await prisma.aIAgent.findMany({ where: { knowledgeBaseIds: { has: id } } });
  await Promise.all(
    agents.map((a) =>
      prisma.aIAgent.update({
        where: { id: a.id },
        data: { knowledgeBaseIds: a.knowledgeBaseIds.filter((k) => k !== id) },
      })
    )
  );
  revalidatePath("/agentes");
}

// ── Fuentes de conocimiento ─────────────────────────────────
export async function addKnowledgeItem(knowledgeBaseId: string, data: {
  type: KnowledgeItemType;
  title: string;
  content?: string | null;
  fileUrl?: string | null;
  sourceUrl?: string | null;
}) {
  const item = await prisma.knowledgeBaseItem.create({
    data: {
      knowledgeBaseId,
      type: data.type,
      title: data.title,
      content: data.content || null,
      fileUrl: data.fileUrl || null,
      sourceUrl: data.sourceUrl || null,
    },
  });
  await prisma.knowledgeBase.update({ where: { id: knowledgeBaseId }, data: { updatedAt: new Date() } });
  revalidatePath(`/agentes/knowledge-base/${knowledgeBaseId}`);
  revalidatePath("/agentes");
  return item;
}

export async function removeKnowledgeItem(id: string) {
  const item = await prisma.knowledgeBaseItem.delete({ where: { id } });
  revalidatePath(`/agentes/knowledge-base/${item.knowledgeBaseId}`);
  revalidatePath("/agentes");
}

// ── Asignación a agentes ────────────────────────────────────
export async function setAgentKnowledgeBases(agentId: string, knowledgeBaseIds: string[]) {
  await prisma.aIAgent.update({ where: { id: agentId }, data: { knowledgeBaseIds } });
  revalidatePath(`/agentes/${agentId}`);
}
