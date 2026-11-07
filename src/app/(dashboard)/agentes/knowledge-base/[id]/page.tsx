import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { KnowledgeBaseDetailClient } from "@/components/agentes/knowledge-base-detail-client";

export default async function KnowledgeBaseDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  if (ctx.role === "AGENTE") notFound();

  const kb = await prisma.knowledgeBase.findFirst({
    where: { id: params.id, workspaceId: ctx.workspace.id },
    include: { items: { orderBy: { createdAt: "desc" } } },
  });

  if (!kb) notFound();

  const serialized = {
    id: kb.id,
    name: kb.name,
    description: kb.description,
    items: kb.items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })),
  };

  return <KnowledgeBaseDetailClient kb={serialized} />;
}
