import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toPublicProperty } from "@/lib/catalog/public-property";
import { CatalogPropertyClient } from "@/components/catalog/catalog-property-client";

async function getData(slug: string, propertyId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    include: { websiteConfig: true },
  });
  if (!workspace?.websiteConfig?.isPublished) return null;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, workspaceId: workspace.id, status: "DISPONIBLE" },
    include: { photos: true },
  });
  if (!property) return null;

  return { workspace, property };
}

export async function generateMetadata({ params }: { params: { slug: string; propertyId: string } }): Promise<Metadata> {
  const data = await getData(params.slug, params.propertyId);
  if (!data) return {};
  return { title: `${data.property.title} — ${data.workspace.name}` };
}

export default async function CatalogPropertyPage({ params }: { params: { slug: string; propertyId: string } }) {
  const data = await getData(params.slug, params.propertyId);
  if (!data) notFound();
  const { workspace, property } = data;
  const config = workspace.websiteConfig!;

  return (
    <CatalogPropertyClient
      slug={workspace.slug}
      workspaceName={workspace.name}
      whatsappNumber={config.whatsappNumber || workspace.whatsappNumber}
      primaryColor={config.primaryColor}
      property={toPublicProperty(property, config.showPrices)}
    />
  );
}
