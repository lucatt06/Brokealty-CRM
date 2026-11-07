import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { listAutomations } from "@/app/actions/automations";
import { AutomatizacionesClient } from "@/components/automatizaciones/automatizaciones-client";

export default async function AutomatizacionesPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");

  const automations = await listAutomations(ctx.workspace.id);

  return <AutomatizacionesClient workspaceId={ctx.workspace.id} automations={automations} />;
}
