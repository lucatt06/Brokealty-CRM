import { prisma } from "@/lib/prisma";

/**
 * Resuelve la primera etapa (menor `order`) del pipeline default del workspace —
 * la entrada natural para cualquier lead nuevo ("Nuevo" en el seed, pero se resuelve
 * por orden y no por nombre para no romperse si un dealer la renombra).
 */
export async function getDefaultPipelineEntryStage(workspaceId: string) {
  const pipeline = await prisma.pipeline.findFirst({
    where: { workspaceId, isDefault: true },
    select: { id: true, stages: { orderBy: { order: "asc" }, take: 1, select: { id: true } } },
  });
  const stage = pipeline?.stages[0];
  if (!pipeline || !stage) return null;
  return { pipelineId: pipeline.id, stageId: stage.id };
}
