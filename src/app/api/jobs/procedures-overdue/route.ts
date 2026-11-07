import { NextRequest, NextResponse } from "next/server";
import { runProceduresOverdueCheck } from "@/lib/jobs/procedures";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runProceduresOverdueCheck();
  return NextResponse.json({ ok: true, ...result });
}
