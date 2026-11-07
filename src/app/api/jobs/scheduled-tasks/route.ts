import { NextRequest, NextResponse } from "next/server";
import { runScheduledTasksSweep } from "@/lib/jobs/run-scheduled-tasks";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runScheduledTasksSweep();
  return NextResponse.json({ ok: true, ...result });
}
