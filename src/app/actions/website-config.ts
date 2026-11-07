"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";

async function requireAdmin() {
  const ctx = await getActiveWorkspace();
  if (!ctx || (ctx.role !== "ADMIN_DEALER" && !ctx.isSuperAdmin)) {
    throw new Error("Solo un Admin Dealer puede editar la página web.");
  }
  return ctx;
}

type WebsiteConfigInput = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  heroImageUrl?: string | null;
  tagline?: string | null;
  aboutText?: string | null;
  whatsappNumber?: string | null;
  addressText?: string | null;
  businessHoursText?: string | null;
  showPrices: boolean;
  isPublished: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export async function updateWebsiteConfig(workspaceId: string, data: WebsiteConfigInput) {
  const ctx = await requireAdmin();
  if (ctx.workspace.id !== workspaceId && !ctx.isSuperAdmin) {
    throw new Error("No tienes acceso a este workspace.");
  }

  await prisma.websiteConfig.upsert({
    where: { workspaceId },
    create: { workspaceId, ...data },
    update: data,
  });

  revalidatePath("/configuracion");
}
