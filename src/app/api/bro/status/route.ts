import { NextResponse } from "next/server";
import { assertOwns, requireCtx } from "@/lib/auth/guards";
import { isCompacting, sessionKey } from "@/lib/bro/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ¿Bro está compactando la sesión de este contacto? Es una ruta y no una Server Action a propósito:
 * Next ejecuta las acciones de un mismo navegador de a una, así que esta consulta quedaría esperando a que
 * terminara justo la respuesta (o compactación) que quiere vigilar.
 */
export async function GET(req: Request) {
  try {
    const ctx = await requireCtx();
    const leadId = new URL(req.url).searchParams.get("leadId") ?? "";
    if (!leadId) return NextResponse.json({ compacting: false }, { status: 400 });
    await assertOwns("lead", leadId, ctx.workspace.id);
    return NextResponse.json({ compacting: isCompacting(sessionKey(ctx.workspace.id, leadId, ctx.user.id)) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ compacting: false }, { status: 401 });
  }
}
