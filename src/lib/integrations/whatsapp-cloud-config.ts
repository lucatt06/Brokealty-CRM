import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

type WhatsAppCloudConfig = { phoneNumberId?: string; encryptedAccessToken?: string };

export async function getWorkspaceWhatsAppCloudConfig(
  workspaceId: string
): Promise<{ phoneNumberId: string; accessToken: string } | null> {
  const integration = await prisma.integration.findFirst({ where: { workspaceId, type: "WHATSAPP_CLOUD", isActive: true } });
  const config = integration?.config as WhatsAppCloudConfig | undefined;
  if (!config?.phoneNumberId || !config.encryptedAccessToken) return null;
  try {
    return { phoneNumberId: config.phoneNumberId, accessToken: decrypt(config.encryptedAccessToken) };
  } catch {
    return null;
  }
}
