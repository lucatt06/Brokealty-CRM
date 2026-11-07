import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { listCampaigns } from "@/app/actions/campaigns";
import { CampanasClient } from "@/components/campanas/campanas-client";

export default async function CampanasPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");

  const [campaigns, leadCount] = await Promise.all([
    listCampaigns(ctx.workspace.id),
    prisma.lead.count({ where: { workspaceId: ctx.workspace.id } }),
  ]);

  return <CampanasClient workspaceId={ctx.workspace.id} campaigns={campaigns} leadCount={leadCount} />;
}
