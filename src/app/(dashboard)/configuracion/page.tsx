import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { listTeamMembers } from "@/app/actions/settings";
import { ConfiguracionClient } from "@/components/configuracion/configuracion-client";

export default async function ConfiguracionPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");

  const [workspace, fullUser, members, websiteConfig, contractTemplates, authorizationRules] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: ctx.workspace.id } }),
    prisma.user.findUnique({ where: { id: ctx.user.id } }),
    listTeamMembers(ctx.workspace.id),
    prisma.websiteConfig.findUnique({ where: { workspaceId: ctx.workspace.id } }),
    prisma.contractTemplate.findMany({ where: { workspaceId: ctx.workspace.id }, orderBy: { createdAt: "desc" } }),
    prisma.authorizationRule.findMany({ where: { workspaceId: ctx.workspace.id }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!workspace) return null;

  return (
    <ConfiguracionClient
      workspace={{
        id: workspace.id, name: workspace.name, logoUrl: workspace.logoUrl,
        currency: workspace.currency, timezone: workspace.timezone,
        whatsappNumber: workspace.whatsappNumber, facebookPageId: workspace.facebookPageId, instagramHandle: workspace.instagramHandle,
      }}
      currentUser={fullUser ? {
        id: fullUser.id, name: fullUser.name, email: fullUser.email,
        phone: fullUser.phone, avatarUrl: fullUser.avatarUrl,
        role: ctx.role,
      } : null}
      members={members}
      websiteConfig={websiteConfig ? {
        subdomain: websiteConfig.subdomain, isPublished: websiteConfig.isPublished,
        logoUrl: websiteConfig.logoUrl, primaryColor: websiteConfig.primaryColor, heroImageUrl: websiteConfig.heroImageUrl,
        tagline: websiteConfig.tagline, aboutText: websiteConfig.aboutText, whatsappNumber: websiteConfig.whatsappNumber,
        addressText: websiteConfig.addressText, businessHoursText: websiteConfig.businessHoursText,
        showPrices: websiteConfig.showPrices, metaTitle: websiteConfig.metaTitle, metaDescription: websiteConfig.metaDescription,
      } : null}
      workspaceSlug={workspace.slug}
      contractTemplates={contractTemplates.map((t) => ({ id: t.id, name: t.name, documentType: t.documentType, bodyTemplate: t.bodyTemplate, isActive: t.isActive }))}
      authorizationRules={authorizationRules.map((r) => ({
        id: r.id, name: r.name, trigger: r.trigger, discountPercentThreshold: r.discountPercentThreshold,
        amountThreshold: r.amountThreshold, requiredApproverRole: r.requiredApproverRole, isActive: r.isActive,
      }))}
    />
  );
}
