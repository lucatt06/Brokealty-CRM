import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { KnowledgeBaseDetailClient } from "@/components/agentes/knowledge-base-detail-client";

export default async function KnowledgeBaseDetailPage({ params }: { params: { id: string } }) {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: params.id },
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
