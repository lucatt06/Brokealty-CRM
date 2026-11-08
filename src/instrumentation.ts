/**
 * Scheduler interno de jobs (reemplaza a Vercel Cron, que no existe en Railway).
 *
 * Cada job es un endpoint /api/jobs/* protegido con CRON_SECRET; este scheduler lo
 * invoca por HTTP local en el intervalo definido. Solo corre en producción y solo si
 * INTERNAL_CRON !== "off".
 *
 * IMPORTANTE: asume UNA sola réplica del servicio web. Con varias réplicas cada una
 * dispararía los jobs; en ese caso se desactiva con INTERNAL_CRON=off y se usa un
 * servicio Cron de Railway aparte.
 */
const JOBS: { path: string; everyMs: number }[] = [
  { path: "/api/jobs/scheduled-tasks", everyMs: 2 * 60_000 },
  { path: "/api/jobs/run-automations", everyMs: 60 * 60_000 },
  { path: "/api/jobs/quotes-expiration", everyMs: 24 * 60 * 60_000 },
  { path: "/api/jobs/procedures-overdue", everyMs: 24 * 60 * 60_000 },
];

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.INTERNAL_CRON === "off") return;
  if (!process.env.CRON_SECRET) {
    console.error("[cron] CRON_SECRET no definido — scheduler interno desactivado.");
    return;
  }

  // Re-registra los webhooks de las instancias de Evolution ya creadas (idempotente; ver sync-webhooks.ts).
  setTimeout(() => {
    import("@/lib/evolution/sync-webhooks")
      .then(({ syncEvolutionWebhooks }) => syncEvolutionWebhooks())
      .then((r) => { if (r.updated || r.failed) console.log(`[evolution] webhooks sincronizados: ${r.updated} actualizados, ${r.failed} con error`); })
      .catch((e) => console.error("[evolution] fallo sincronizando webhooks:", e));
  }, 20_000);

  const base = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  for (const job of JOBS) {
    const run = async () => {
      try {
        const res = await fetch(`${base}${job.path}`, {
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        });
        if (!res.ok) console.error(`[cron] ${job.path} respondió ${res.status}`);
      } catch (e) {
        console.error(`[cron] ${job.path} falló:`, e);
      }
    };
    // Primer disparo diferido para no competir con el arranque.
    setTimeout(run, 30_000);
    setInterval(run, job.everyMs).unref();
  }
  console.log(`[cron] scheduler interno activo (${JOBS.length} jobs)`);
}
