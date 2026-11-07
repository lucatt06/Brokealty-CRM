import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { AgentesClient } from "@/components/agentes/agentes-client";

export default async function AgentesPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  const workspaceId = ctx.workspace.id;

  const [agents, aiConversations, knowledgeBases] = await Promise.all([
    prisma.aIAgent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.conversation.findMany({
      where: { workspaceId, isAiHandled: true },
      include: {
        lead: { select: { firstName: true, lastName: true } },
        messages: { orderBy: { sentAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    }),
    prisma.knowledgeBase.findMany({
      where: { workspaceId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const serializedAgents = agents.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  const serializedConversations = aiConversations.map((c) => ({
    id: c.id,
    channel: c.channel,
    leadName: c.lead ? `${c.lead.firstName} ${c.lead.lastName ?? ""}`.trim() : "Sin contacto",
    lastMessageAt: c.messages[0]?.sentAt.toISOString() ?? c.lastMessageAt?.toISOString() ?? null,
    messageCount: c._count.messages,
  }));

  const serializedKnowledgeBases = knowledgeBases.map((k) => ({
    id: k.id,
    name: k.name,
    itemsCount: k._count.items,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
  }));

  return (
    <AgentesClient
      agents={serializedAgents}
      conversations={serializedConversations}
      workspaceId={workspaceId}
      knowledgeBases={serializedKnowledgeBases}
    />
  );
}
