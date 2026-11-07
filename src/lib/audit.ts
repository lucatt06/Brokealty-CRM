import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * audit_logs vive en la BD (creada vía prisma db push) pero el cliente de
 * Prisma no se pudo regenerar en esta sesión porque otro proceso tiene el
 * motor bloqueado — por eso se usa SQL crudo aquí en vez de prisma.auditLog.
 * Cuando se pueda regenerar, esto se puede migrar al cliente tipado.
 */
export async function logAuditEvent(params: {
  actorUserId: string;
  actorName: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  action: string;
  details?: Record<string, unknown>;
}) {
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO audit_logs (id, "actorUserId", "actorName", "workspaceId", "workspaceName", action, details, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())`,
    id,
    params.actorUserId,
    params.actorName,
    params.workspaceId ?? null,
    params.workspaceName ?? null,
    params.action,
    JSON.stringify(params.details ?? {})
  );
}

export type AuditLogEntry = {
  id: string;
  actorName: string;
  workspaceId: string | null;
  workspaceName: string | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export async function listRecentAuditLogs(limit = 30): Promise<AuditLogEntry[]> {
  const rows = await prisma.$queryRawUnsafe<AuditLogEntry[]>(
    `SELECT id, "actorName", "workspaceId", "workspaceName", action, details, "createdAt"
     FROM audit_logs ORDER BY "createdAt" DESC LIMIT $1`,
    limit
  );
  return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).toISOString() }));
}
