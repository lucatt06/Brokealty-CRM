import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AgentEditorClient } from "@/components/agentes/agent-editor-client";
import { ensureBuiltInTools } from "@/app/actions/agent-config";

export default async function AgentEditorPage({ params }: { params: { id: string } }) {
  const agent = await prisma.aIAgent.findUnique({
    where: { id: params.id },
    include: { workspace: { select: { name: true } } },
  });

  if (!agent) notFound();

  await ensureBuiltInTools(agent.workspaceId);

  const [otherAgents, workspaceUsers, tags, workflows, tools, knowledgeBases] = await Promise.all([
    prisma.aIAgent.findMany({
      where: { workspaceId: agent.workspaceId, id: { not: agent.id } },
      select: { id: true, name: true, status: true, channels: true, isPrimary: true },
    }),
    prisma.workspaceUser.findMany({
      where: { workspaceId: agent.workspaceId },
      select: { user: { select: { id: true, name: true } } },
    }),
    prisma.tag.findMany({ where: { workspaceId: agent.workspaceId }, orderBy: { name: "asc" } }),
    prisma.automation.findMany({
      where: { workspaceId: agent.workspaceId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.agentTool.findMany({ where: { workspaceId: agent.workspaceId }, orderBy: { name: "asc" } }),
    prisma.knowledgeBase.findMany({
      where: { workspaceId: agent.workspaceId },
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = {
    ...agent,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    actionsConfig: agent.actionsConfig as Record<string, unknown> | null,
    conversationSummaryConfig: agent.conversationSummaryConfig as Record<string, unknown> | null,
  };

  return (
    <AgentEditorClient
      agent={serialized}
      workspaceName={agent.workspace.name}
      otherAgents={otherAgents}
      users={workspaceUsers.map((wu) => wu.user)}
      tags={tags}
      workflows={workflows}
      tools={tools.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
      knowledgeBases={knowledgeBases.map((k) => ({ id: k.id, name: k.name, itemsCount: k._count.items }))}
    />
  );
}
