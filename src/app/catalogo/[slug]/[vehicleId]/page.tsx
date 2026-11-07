import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toPublicVehicle } from "@/lib/catalog/public-vehicle";
import { CatalogVehicleClient } from "@/components/catalog/catalog-vehicle-client";

async function getData(slug: string, vehicleId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    include: { websiteConfig: true },
  });
  if (!workspace?.websiteConfig?.isPublished) return null;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workspaceId: workspace.id, status: "DISPONIBLE" },
    include: { photos: true },
  });
  if (!vehicle) return null;

  return { workspace, vehicle };
}

export async function generateMetadata({ params }: { params: { slug: string; vehicleId: string } }): Promise<Metadata> {
  const data = await getData(params.slug, params.vehicleId);
  if (!data) return {};
  const { make, model, year } = data.vehicle;
  return { title: `${make} ${model} ${year} — ${data.workspace.name}` };
}

export default async function CatalogVehiclePage({ params }: { params: { slug: string; vehicleId: string } }) {
  const data = await getData(params.slug, params.vehicleId);
  if (!data) notFound();
  const { workspace, vehicle } = data;
  const config = workspace.websiteConfig!;

  return (
    <CatalogVehicleClient
      slug={workspace.slug}
      workspaceName={workspace.name}
      whatsappNumber={config.whatsappNumber || workspace.whatsappNumber}
      primaryColor={config.primaryColor}
      vehicle={toPublicVehicle(vehicle, config.showPrices)}
    />
  );
}
