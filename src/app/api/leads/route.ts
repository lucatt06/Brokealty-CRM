import { prisma } from "@/lib/prisma";
import { ENTRY_STAGE_NAME } from "@/lib/pipeline/default-stages";
import { NextRequest, NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { fireAutomationTrigger } from "@/lib/jobs/run-automations";
import { getDefaultPipelineEntryStage } from "@/lib/leads/default-deal";
import { LISTING_TYPES, PROPERTY_TYPES } from "@/lib/properties/labels";

async function getWorkspaceId() {
  const ctx = await getActiveWorkspace();
  return ctx?.workspace.id ?? "";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const WORKSPACE_ID = await getWorkspaceId();

  const entryStage = await getDefaultPipelineEntryStage(WORKSPACE_ID);

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        workspaceId: WORKSPACE_ID,
        firstName: body.firstName,
        lastName: body.lastName ?? null,
        phone: body.phone,
        email: body.email ?? null,
        source: body.source ?? "MANUAL",
        assignedTo: body.assignedTo ?? null,
        notes: body.notes ?? null,
        desiredPropertyType: PROPERTY_TYPES.includes(body.desiredPropertyType) ? body.desiredPropertyType : null,
        desiredListingType: LISTING_TYPES.includes(body.desiredListingType) ? body.desiredListingType : null,
        desiredCity: body.desiredCity?.trim() || null,
        desiredSector: body.desiredSector?.trim() || null,
        desiredBedrooms: body.desiredBedrooms ? Number(body.desiredBedrooms) : null,
        budgetMin: body.budgetMin ? Number(body.budgetMin) : null,
        budgetMax: body.budgetMax ? Number(body.budgetMax) : null,
        budgetCurrency: body.budgetCurrency === "USD" ? "USD" : "DOP",
        stage: ENTRY_STAGE_NAME,
        score: 0,
      },
      include: { assignedUser: { select: { id: true, name: true } } },
    });
    // Todo contacto nuevo entra al pipeline en su primera etapa — mismo criterio
    // que el webhook de WhatsApp.
    if (entryStage) {
      await tx.deal.create({
        data: {
          workspaceId: WORKSPACE_ID, leadId: created.id,
          pipelineId: entryStage.pipelineId, stageId: entryStage.stageId,
          currency: "DOP",
        },
      });
    }
    return created;
  });

  await fireAutomationTrigger(WORKSPACE_ID, "LEAD_CREATED", { leadId: lead.id });

  return NextResponse.json({
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    lastContact: null,
    scoreUpdatedAt: null,
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const WORKSPACE_ID = await getWorkspaceId();

  await prisma.lead.update({
    where: { id, workspaceId: WORKSPACE_ID },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
