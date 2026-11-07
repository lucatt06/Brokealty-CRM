import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { getSuperAdminOverview } from "@/app/actions/super-admin";
import { SuperAdminClient } from "@/components/super-admin/super-admin-client";

export default async function SuperAdminPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");
  if (!ctx.isSuperAdmin) redirect("/dashboard");

  const overview = await getSuperAdminOverview();

  return <SuperAdminClient overview={overview} />;
}
