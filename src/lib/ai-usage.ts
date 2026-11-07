import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * ai_usage_logs vive en la BD pero, igual que audit_logs, se accede por SQL
 * crudo mientras el cliente de Prisma no se pueda regenerar (ver audit.ts).
 */
export async function logAiUsage(params: {
  workspaceId: string;
  agentId?: string | null;
  provider: "ANTHROPIC" | "OPENAI";
  model: string;
  inputTokens: number;
  outputTokens: number;
  usedSharedKey: boolean;
}) {
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO ai_usage_logs (id, "workspaceId", "agentId", provider, model, "inputTokens", "outputTokens", "usedSharedKey", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    id,
    params.workspaceId,
    params.agentId ?? null,
    params.provider,
    params.model,
    params.inputTokens,
    params.outputTokens,
    params.usedSharedKey
  );
}

export type WorkspaceUsageSummary = {
  workspaceId: string;
  workspaceName: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  sharedKeyTokens: number;
  callCount: number;
};

export async function listUsageByWorkspace(sinceDays = 30): Promise<WorkspaceUsageSummary[]> {
  const rows = await prisma.$queryRawUnsafe<
    { workspaceId: string; workspaceName: string; totalinputtokens: bigint; totaloutputtokens: bigint; sharedkeytokens: bigint; callcount: bigint }[]
  >(
    `SELECT u."workspaceId", w.name AS "workspaceName",
        COALESCE(SUM(u."inputTokens"), 0) AS totalinputtokens,
        COALESCE(SUM(u."outputTokens"), 0) AS totaloutputtokens,
        COALESCE(SUM(CASE WHEN u."usedSharedKey" THEN u."inputTokens" + u."outputTokens" ELSE 0 END), 0) AS sharedkeytokens,
        COUNT(*) AS callcount
     FROM ai_usage_logs u
     JOIN workspaces w ON w.id = u."workspaceId"
     WHERE u."createdAt" >= now() - ($1 || ' days')::interval
     GROUP BY u."workspaceId", w.name
     ORDER BY totaloutputtokens DESC`,
    sinceDays
  );
  return rows.map((r) => ({
    workspaceId: r.workspaceId,
    workspaceName: r.workspaceName,
    totalInputTokens: Number(r.totalinputtokens),
    totalOutputTokens: Number(r.totaloutputtokens),
    sharedKeyTokens: Number(r.sharedkeytokens),
    callCount: Number(r.callcount),
  }));
}
