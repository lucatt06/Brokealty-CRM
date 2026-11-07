import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toPublicProperty } from "@/lib/catalog/public-property";
import { CatalogClient } from "@/components/catalog/catalog-client";

async function getPublishedWorkspace(slug: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    include: { websiteConfig: true },
  });
  if (!workspace?.websiteConfig?.isPublished) return null;
  return workspace;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const workspace = await getPublishedWorkspace(params.slug);
  if (!workspace) return {};
  return {
    title: workspace.websiteConfig!.metaTitle || `Catálogo de propiedades — ${workspace.name}`,
    description: workspace.websiteConfig!.metaDescription || workspace.websiteConfig!.tagline || undefined,
  };
}

export default async function CatalogPage({ params }: { params: { slug: string } }) {
  const workspace = await getPublishedWorkspace(params.slug);
  if (!workspace) notFound();
  const config = workspace.websiteConfig!;

  const properties = await prisma.property.findMany({
    where: { workspaceId: workspace.id, status: "DISPONIBLE" },
    include: { photos: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <CatalogClient
      slug={workspace.slug}
      workspaceName={workspace.name}
      whatsappNumber={config.whatsappNumber || workspace.whatsappNumber}
      logoUrl={config.logoUrl}
      primaryColor={config.primaryColor}
      tagline={config.tagline}
      heroImageUrl={config.heroImageUrl}
      featuredIds={config.featuredPropertyIds}
      properties={properties.map((p) => toPublicProperty(p, config.showPrices))}
    />
  );
}
