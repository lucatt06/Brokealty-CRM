import { NextRequest, NextResponse } from "next/server";
import { runInactivityAutomations, runAppointmentReminders, runTaskDueCheck } from "@/lib/jobs/run-automations";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [inactivity, appointmentReminders, taskDue] = await Promise.all([
    runInactivityAutomations(),
    runAppointmentReminders(),
    runTaskDueCheck(),
  ]);

  return NextResponse.json({ ok: true, inactivity, appointmentReminders, taskDue });
}
