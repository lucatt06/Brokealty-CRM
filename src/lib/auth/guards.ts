import { prisma } from "@/lib/prisma";
import { getActiveWorkspace, type ActiveWorkspaceContext } from "@/lib/auth/active-workspace";

/**
 * Guardas de autorización para Server Actions y route handlers.
 *
 * Regla: una Server Action es un endpoint público. Toda acción debe (1) exigir sesión,
 * (2) derivar el workspace de la SESIÓN —nunca de un parámetro del cliente— y (3) verificar
 * que cada id que recibe pertenezca a ese workspace antes de leerlo o modificarlo.
 */

export class AuthError extends Error {}

export async function requireCtx(): Promise<ActiveWorkspaceContext> {
  const ctx = await getActiveWorkspace();
  if (!ctx) throw new AuthError("Sesión no válida.");
  return ctx;
}

const isAdmin = (ctx: ActiveWorkspaceContext) => ctx.role === "ADMIN" || ctx.isSuperAdmin;

/** ADMIN de la inmobiliaria activa, o Super Admin. */
export async function requireAdminCtx(message = "Solo un Administrador puede hacer esto."): Promise<ActiveWorkspaceContext> {
  const ctx = await requireCtx();
  if (!isAdmin(ctx)) throw new AuthError(message);
  return ctx;
}

export async function requireSuperAdminCtx(): Promise<ActiveWorkspaceContext> {
  const ctx = await requireCtx();
  if (!ctx.isSuperAdmin) throw new AuthError("Solo un Super Admin puede hacer esto.");
  return ctx;
}

/** El workspace que el cliente dice usar debe ser el de la sesión (el Super Admin cambia de tenant con el selector). */
export function assertWorkspace(ctx: ActiveWorkspaceContext, workspaceId: string) {
  if (ctx.workspace.id !== workspaceId) throw new AuthError("No tienes acceso a este workspace.");
}

const NOT_FOUND = "Registro no encontrado.";

type Counter = (id: string, ws: string) => Promise<number>;

/** Un contador por modelo: cuenta registros con ese id DENTRO del workspace. */
const OWNERSHIP = {
  lead: (id, ws) => prisma.lead.count({ where: { id, workspaceId: ws } }),
  deal: (id, ws) => prisma.deal.count({ where: { id, workspaceId: ws } }),
  task: (id, ws) => prisma.task.count({ where: { id, workspaceId: ws } }),
  appointment: (id, ws) => prisma.appointment.count({ where: { id, workspaceId: ws } }),
  conversation: (id, ws) => prisma.conversation.count({ where: { id, workspaceId: ws } }),
  quote: (id, ws) => prisma.quote.count({ where: { id, workspaceId: ws } }),
  contract: (id, ws) => prisma.contract.count({ where: { id, workspaceId: ws } }),
  salesOrder: (id, ws) => prisma.salesOrder.count({ where: { id, workspaceId: ws } }),
  payment: (id, ws) => prisma.payment.count({ where: { id, workspaceId: ws } }),
  procedure: (id, ws) => prisma.postSaleProcedure.count({ where: { id, workspaceId: ws } }),
  operationDocument: (id, ws) => prisma.operationDocument.count({ where: { id, workspaceId: ws } }),
  agent: (id, ws) => prisma.aIAgent.count({ where: { id, workspaceId: ws } }),
  agentTool: (id, ws) => prisma.agentTool.count({ where: { id, workspaceId: ws } }),
  knowledgeBase: (id, ws) => prisma.knowledgeBase.count({ where: { id, workspaceId: ws } }),
  knowledgeItem: (id, ws) => prisma.knowledgeBaseItem.count({ where: { id, knowledgeBase: { workspaceId: ws } } }),
  automation: (id, ws) => prisma.automation.count({ where: { id, workspaceId: ws } }),
  campaign: (id, ws) => prisma.campaign.count({ where: { id, workspaceId: ws } }),
  tag: (id, ws) => prisma.tag.count({ where: { id, workspaceId: ws } }),
  ddc: (id, ws) => prisma.customerDueDiligence.count({ where: { id, workspaceId: ws } }),
  pipeline: (id, ws) => prisma.pipeline.count({ where: { id, workspaceId: ws } }),
  stage: (id, ws) => prisma.pipelineStage.count({ where: { id, pipeline: { workspaceId: ws } } }),
  property: (id, ws) => prisma.property.count({ where: { id, workspaceId: ws } }),
  workspaceUser: (id, ws) => prisma.workspaceUser.count({ where: { id, workspaceId: ws } }),
  commission: (id, ws) => prisma.commission.count({ where: { id, workspaceId: ws } }),
  commissionRule: (id, ws) => prisma.commissionRule.count({ where: { id, workspaceId: ws } }),
  contractTemplate: (id, ws) => prisma.contractTemplate.count({ where: { id, workspaceId: ws } }),
  authorization: (id, ws) => prisma.salesAuthorization.count({ where: { id, workspaceId: ws } }),
  authorizationRule: (id, ws) => prisma.authorizationRule.count({ where: { id, workspaceId: ws } }),
} satisfies Record<string, Counter>;

export type OwnedKind = keyof typeof OWNERSHIP;

/** Lanza si alguno de los ids no pertenece al workspace. `null/undefined` se ignoran (campos opcionales). */
export async function assertOwns(kind: OwnedKind, ids: string | null | undefined | (string | null | undefined)[], workspaceId: string) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter((v): v is string => !!v);
  for (const id of new Set(list)) {
    if ((await OWNERSHIP[kind](id, workspaceId)) === 0) throw new AuthError(NOT_FOUND);
  }
}

/** Un usuario es "del equipo" si es miembro activo del workspace (para asignaciones a agentes). */
export async function assertMember(userId: string | null | undefined, workspaceId: string) {
  if (!userId) return;
  const m = await prisma.workspaceUser.count({ where: { userId, workspaceId, isActive: true } });
  if (m === 0) throw new AuthError("Ese usuario no pertenece al equipo.");
}
