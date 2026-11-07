"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

type JsonObj = Record<string, unknown>;
type ToolCategory = "PLATFORM" | "EXTRACTION" | "TRANSFER" | "ADD_TAG" | "REMOVE_TAG" | "CUSTOM" | "WORKFLOWS";

export async function saveActionConfig(agentId: string, actionKey: string, config: JsonObj) {
  const agent = await prisma.aIAgent.findUnique({ where: { id: agentId }, select: { actionsConfig: true, actions: true } });
  const currentConfig = (agent?.actionsConfig as JsonObj) ?? {};
  const actions = agent?.actions ?? [];
  const nextActions = actions.includes(actionKey) ? actions : [...actions, actionKey];

  await prisma.aIAgent.update({
    where: { id: agentId },
    data: {
      actionsConfig: { ...currentConfig, [actionKey]: config } as Prisma.InputJsonValue,
      actions: nextActions,
    },
  });
  revalidatePath("/agentes");
}

export async function removeActionConfig(agentId: string, actionKey: string) {
  const agent = await prisma.aIAgent.findUnique({ where: { id: agentId }, select: { actionsConfig: true, actions: true } });
  const currentConfig = { ...((agent?.actionsConfig as JsonObj) ?? {}) };
  delete currentConfig[actionKey];
  const actions = (agent?.actions ?? []).filter((a) => a !== actionKey);

  await prisma.aIAgent.update({
    where: { id: agentId },
    data: {
      actionsConfig: currentConfig as Prisma.InputJsonValue,
      actions,
    },
  });
  revalidatePath("/agentes");
}

export async function updateConversationSummary(agentId: string, enabled: boolean, config: JsonObj) {
  await prisma.aIAgent.update({
    where: { id: agentId },
    data: { conversationSummaryEnabled: enabled, conversationSummaryConfig: config as Prisma.InputJsonValue },
  });
  revalidatePath("/agentes");
}

export async function setAssignedTools(agentId: string, toolIds: string[]) {
  await prisma.aIAgent.update({ where: { id: agentId }, data: { assignedToolIds: toolIds } });
  revalidatePath("/agentes");
}

// ── Tool Kit ───────────────────────────────────────────────
const BUILT_IN_TOOLS: Omit<Prisma.AgentToolCreateManyInput, "workspaceId">[] = [
  { key: "create_note", name: "Create Note", description: "Adds a note to a contact's record", category: "PLATFORM", method: "POST", examplePrompt: "Make a note that they called about refund.", isBuiltIn: true },
  { key: "create_task", name: "Create Task", description: "Creates a to-do in your CRM for your team", category: "PLATFORM", method: "POST", examplePrompt: "Can you remind the team to follow up?", isBuiltIn: true },
  { key: "enviar_informacion", name: "Enviar Informacion", description: "Usa esta tool para enviar la informacion al cliente cuando la solicite", category: "ADD_TAG", method: "POST", examplePrompt: null, isBuiltIn: true },
  { key: "get_availability", name: "Get Availability", description: "Checks your calendar for open slots", category: "PLATFORM", method: "POST", examplePrompt: "When are you available this week?", isBuiltIn: true },
  { key: "get_user_calendar_events", name: "Get User Calendar Events", description: "Looks up a contact's appointments", category: "PLATFORM", method: "POST", examplePrompt: "What did I book last time?", isBuiltIn: true },
  { key: "scrape_website", name: "Scrape Website", description: "Reads a website's contents for the assistant", category: "EXTRACTION", method: "POST", examplePrompt: "Check their pricing page for me.", isBuiltIn: true },
  { key: "search_the_web", name: "Search The Web", description: "Searches the web to answer caller questions", category: "EXTRACTION", method: "POST", examplePrompt: "What are your hours on weekends?", isBuiltIn: true },
  { key: "self_schedule", name: "Self Schedule", description: "Schedules a callback at a later time", category: "PLATFORM", method: "POST", examplePrompt: "Actually, call me back tomorrow at 3.", isBuiltIn: true },
  { key: "send_email", name: "Send Email", description: "Sends an email to the contact", category: "PLATFORM", method: "POST", examplePrompt: "Can you email me a confirmation?", isBuiltIn: true },
  { key: "update_appointment_details", name: "Update Appointment Details", description: "Changes or reschedules an appointment", category: "PLATFORM", method: "POST", examplePrompt: "Can we move it to Friday?", isBuiltIn: true },
  { key: "update_user_details", name: "Update User Details", description: "Saves verified contact info to your CRM", category: "PLATFORM", method: "POST", examplePrompt: "My email is sarah@example.com.", isBuiltIn: true },
  { key: "remove_tag", name: "Remove Tag", description: "Removes a tag from the contact's record", category: "REMOVE_TAG", method: "POST", examplePrompt: "This lead is no longer interested.", isBuiltIn: true },
  { key: "search_inventory", name: "Search Inventory", description: "Busca vehículos disponibles en el inventario por marca, modelo, año o precio", category: "PLATFORM", method: "POST", examplePrompt: "¿Qué Toyota Corolla tienen disponibles?", isBuiltIn: true },
  { key: "send_vehicle_photos", name: "Send Vehicle Photos", description: "Envía las fotos de un vehículo del inventario al contacto", category: "PLATFORM", method: "POST", examplePrompt: "¿Me puedes mandar fotos de ese carro?", isBuiltIn: true },
];

export async function ensureBuiltInTools(workspaceId: string) {
  const existing = await prisma.agentTool.findMany({ where: { workspaceId, isBuiltIn: true }, select: { key: true } });
  const existingKeys = new Set(existing.map((t) => t.key));
  const missing = BUILT_IN_TOOLS.filter((t) => !existingKeys.has(t.key));
  if (missing.length) {
    await prisma.agentTool.createMany({
      data: missing.map((t) => ({ ...t, workspaceId })),
      skipDuplicates: true,
    });
  }
}

export async function createCustomTool(workspaceId: string, data: {
  name: string; description: string; category: ToolCategory; examplePrompt?: string | null;
}) {
  const key = `custom_${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}_${Date.now()}`;
  const tool = await prisma.agentTool.create({
    data: {
      workspaceId,
      key,
      name: data.name,
      description: data.description,
      category: data.category,
      examplePrompt: data.examplePrompt || null,
      isBuiltIn: false,
    },
  });
  revalidatePath("/agentes");
  return tool;
}

export async function deleteCustomTool(id: string) {
  await prisma.agentTool.delete({ where: { id } });
  revalidatePath("/agentes");
}
