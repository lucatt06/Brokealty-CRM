import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { listIntegrations } from "@/app/actions/integrations";
import { IntegracionesClient } from "@/components/integraciones/integraciones-client";

export default async function IntegracionesPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");

  const integrations = await listIntegrations(ctx.workspace.id);

  return (
    <Suspense>
      <IntegracionesClient workspaceId={ctx.workspace.id} integrations={integrations} />
    </Suspense>
  );
}
