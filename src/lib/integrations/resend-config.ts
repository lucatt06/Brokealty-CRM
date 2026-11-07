import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

type ResendConfig = { encryptedKey?: string; fromEmail?: string };

export async function getWorkspaceResendConfig(workspaceId: string): Promise<{ apiKey: string; fromEmail: string } | null> {
  const integration = await prisma.integration.findFirst({ where: { workspaceId, type: "RESEND", isActive: true } });
  const config = integration?.config as ResendConfig | undefined;
  if (!config?.encryptedKey || !config.fromEmail) return null;
  try {
    return { apiKey: decrypt(config.encryptedKey), fromEmail: config.fromEmail };
  } catch {
    return null;
  }
}
