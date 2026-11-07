import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import type { ActionDefinition } from "../types";
import { getWorkspaceAiKey } from "@/lib/integrations/ai-keys";
import { sendMessageAction } from "./send-message";

/**
 * Nivel 1 de "IA en automatizaciones": la IA solo redacta texto (una llamada
 * de Claude, sin tools, sin poder de decisión), y el resultado se entrega al
 * handler send_message ya existente. Predecible y de bajo riesgo — es la IA
 * escribiendo, no actuando.
 */
export const aiGenerateMessageAction: ActionDefinition = {
  key: "ai_generate_message",
  execute: async (rawInput, ctx) => {
    const input = rawInput as { instruction?: string };
    const instruction = String(input.instruction ?? "").trim();
    if (!instruction) return "Falta la instrucción para que la IA redacte el mensaje.";
    if (!ctx.leadId) return "No hay contacto asociado.";

    const apiKey = (await getWorkspaceAiKey(ctx.workspaceId, "ANTHROPIC")) ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return "Configura una API key de Anthropic en Integraciones (o ANTHROPIC_API_KEY en .env.local).";

    const lead = await prisma.lead.findUnique({
      where: { id: ctx.leadId },
      include: { interestedVehicle: { select: { make: true, model: true, year: true, priceDOP: true } } },
    });
    if (!lead) return "Contacto no encontrado.";

    const recentMessages = ctx.conversationId
      ? await prisma.message.findMany({ where: { conversationId: ctx.conversationId }, orderBy: { sentAt: "desc" }, take: 6 })
      : [];

    const contextLines = [
      `Nombre del contacto: ${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}`,
      lead.interestedVehicle
        ? `Vehículo de interés: ${lead.interestedVehicle.make} ${lead.interestedVehicle.model} ${lead.interestedVehicle.year}${lead.interestedVehicle.priceDOP ? ` (RD$${lead.interestedVehicle.priceDOP})` : ""}`
        : null,
      lead.budgetMax ? `Presupuesto: hasta ${lead.budgetCurrency} ${lead.budgetMax}` : null,
      recentMessages.length
        ? `Últimos mensajes (más reciente primero):\n${recentMessages.map((m) => `${m.direction === "INBOUND" ? "Cliente" : "Dealer"}: ${m.content}`).join("\n")}`
        : null,
    ].filter(Boolean).join("\n");

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system:
        "Eres un redactor de mensajes de WhatsApp para un dealer de vehículos. Escribe SOLO el texto final del " +
        "mensaje, sin explicaciones ni comillas, en español, con tono cercano y profesional.",
      messages: [{ role: "user", content: `Contexto del contacto:\n${contextLines}\n\nInstrucción: ${instruction}` }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return "La IA no generó ningún texto.";

    return sendMessageAction.execute({ content: text }, ctx);
  },
};
