import { prisma } from "@/lib/prisma";
import { setInstanceWebhook } from "@/lib/evolution/client";

/**
 * Cada vez que cambia la lista de eventos o los headers del webhook (EVOLUTION_WEBHOOK_VERSION),
 * las instancias de Evolution YA creadas hay que re-registrarlas: Evolution guarda el webhook por
 * instancia y no lo actualiza solo. Se ejecuta al arrancar la app; es idempotente y cada
 * instancia se marca con la versión aplicada para no repetirlo en cada despliegue.
 */
export const EVOLUTION_WEBHOOK_VERSION = 2; // 2 = + MESSAGES_EDITED y MESSAGES_DELETE

type Config = { instanceName?: string; webhookVersion?: number; [k: string]: unknown };

export async function syncEvolutionWebhooks(): Promise<{ updated: number; failed: number }> {
  const integrations = await prisma.integration.findMany({ where: { type: "WHATSAPP_EVOLUTION" } });
  let updated = 0, failed = 0;
  for (const integration of integrations) {
    const config = integration.config as Config;
    if (!config.instanceName || !integration.webhookUrl || (config.webhookVersion ?? 0) >= EVOLUTION_WEBHOOK_VERSION) continue;
    try {
      await setInstanceWebhook(config.instanceName, integration.webhookUrl);
      await prisma.integration.update({ where: { id: integration.id }, data: { config: { ...config, webhookVersion: EVOLUTION_WEBHOOK_VERSION } } });
      updated++;
    } catch (e) {
      failed++;
      console.error(`[evolution] no se pudo actualizar el webhook de ${config.instanceName}:`, e instanceof Error ? e.message : e);
    }
  }
  return { updated, failed };
}
