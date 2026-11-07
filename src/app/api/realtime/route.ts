import { Client } from "pg";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events con los cambios de `messages` / `conversations` del workspace
 * activo del usuario. Reemplaza a Supabase Realtime: triggers de Postgres hacen
 * `pg_notify('crm_events', ...)` y este endpoint hace LISTEN y reenvía solo lo que
 * pertenece al workspace de la sesión (aislamiento multi-tenant en el servidor).
 */
export async function GET(req: Request) {
  const ctx = await getActiveWorkspace();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const workspaceId = ctx.workspace.id;

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query("LISTEN crm_events");

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        pg.end().catch((e) => console.error("[realtime] error cerrando conexión pg:", e));
        try {
          controller.close();
        } catch {
          // El stream ya estaba cerrado por el cliente.
        }
      };

      pg.on("notification", (msg) => {
        if (!msg.payload) return;
        try {
          const evt = JSON.parse(msg.payload) as { workspaceId?: string };
          if (evt.workspaceId === workspaceId) send(`data: ${msg.payload}\n\n`);
        } catch (e) {
          console.error("[realtime] payload inválido:", e);
        }
      });
      pg.on("error", (e) => {
        console.error("[realtime] error de conexión pg:", e);
        close();
      });

      send("retry: 3000\n\n");
      heartbeat = setInterval(() => send(": ping\n\n"), 25000);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      pg.end().catch((e) => console.error("[realtime] error cerrando conexión pg:", e));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
