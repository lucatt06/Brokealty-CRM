import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { PaginaWebTab } from "@/components/pagina-web/pagina-web-tab";

export default async function PaginaWebPage() {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/login");

  const [workspace, websiteConfig] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: ctx.workspace.id }, select: { slug: true } }),
    prisma.websiteConfig.findUnique({ where: { workspaceId: ctx.workspace.id } }),
  ]);
  if (!workspace) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Página Web</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configura el catálogo público de tu inventario.</p>
        </div>
        <PaginaWebTab
          workspaceId={ctx.workspace.id}
          slug={workspace.slug}
          config={websiteConfig ? {
            subdomain: websiteConfig.subdomain, isPublished: websiteConfig.isPublished,
            logoUrl: websiteConfig.logoUrl, primaryColor: websiteConfig.primaryColor, heroImageUrl: websiteConfig.heroImageUrl,
            tagline: websiteConfig.tagline, aboutText: websiteConfig.aboutText, whatsappNumber: websiteConfig.whatsappNumber,
            addressText: websiteConfig.addressText, businessHoursText: websiteConfig.businessHoursText,
            showPrices: websiteConfig.showPrices, metaTitle: websiteConfig.metaTitle, metaDescription: websiteConfig.metaDescription,
          } : null}
        />
      </div>
    </div>
  );
}
