import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

type AiKeyConfig = { encryptedKey?: string };

/**
 * Devuelve la API key propia del workspace para el proveedor dado, si la configuró
 * en Integraciones. Si no hay una, devuelve null y el llamador debe usar la key
 * compartida (env var) — así cada dealer paga sus propios tokens cuando quiere.
 */
export async function getWorkspaceAiKey(workspaceId: string, provider: "ANTHROPIC" | "OPENAI"): Promise<string | null> {
  const integration = await prisma.integration.findFirst({
    where: { workspaceId, type: provider, isActive: true },
  });
  const config = integration?.config as AiKeyConfig | undefined;
  if (!config?.encryptedKey) return null;
  try {
    return decrypt(config.encryptedKey);
  } catch {
    return null;
  }
}
