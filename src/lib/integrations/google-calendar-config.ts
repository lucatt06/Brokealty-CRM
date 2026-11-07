import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

type GoogleCalendarStoredConfig = {
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  expiresAt?: string;
  email?: string;
};

export type GoogleCalendarTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string | null;
};

export async function getWorkspaceGoogleCalendarTokens(workspaceId: string): Promise<GoogleCalendarTokens | null> {
  const integration = await prisma.integration.findFirst({ where: { workspaceId, type: "GOOGLE_CALENDAR", isActive: true } });
  const config = integration?.config as GoogleCalendarStoredConfig | undefined;
  if (!config?.encryptedAccessToken || !config.encryptedRefreshToken || !config.expiresAt) return null;
  try {
    return {
      accessToken: decrypt(config.encryptedAccessToken),
      refreshToken: decrypt(config.encryptedRefreshToken),
      expiresAt: new Date(config.expiresAt),
      email: config.email ?? null,
    };
  } catch {
    return null;
  }
}

export async function saveWorkspaceGoogleCalendarTokens(
  workspaceId: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: Date; email: string }
) {
  await prisma.integration.upsert({
    where: { workspaceId_type: { workspaceId, type: "GOOGLE_CALENDAR" } },
    create: {
      workspaceId,
      type: "GOOGLE_CALENDAR",
      name: "Google Calendar",
      isActive: true,
      config: {
        encryptedAccessToken: encrypt(tokens.accessToken),
        encryptedRefreshToken: encrypt(tokens.refreshToken),
        expiresAt: tokens.expiresAt.toISOString(),
        email: tokens.email,
      },
    },
    update: {
      isActive: true,
      config: {
        encryptedAccessToken: encrypt(tokens.accessToken),
        encryptedRefreshToken: encrypt(tokens.refreshToken),
        expiresAt: tokens.expiresAt.toISOString(),
        email: tokens.email,
      },
    },
  });
}

export async function updateWorkspaceGoogleCalendarAccessToken(workspaceId: string, accessToken: string, expiresAt: Date) {
  const integration = await prisma.integration.findFirst({ where: { workspaceId, type: "GOOGLE_CALENDAR" } });
  if (!integration) return;
  const config = integration.config as GoogleCalendarStoredConfig;
  await prisma.integration.update({
    where: { id: integration.id },
    data: { config: { ...config, encryptedAccessToken: encrypt(accessToken), expiresAt: expiresAt.toISOString() } },
  });
}
