"use server";

import { AuthError, assertOwns, assertWorkspace, requireAdminCtx } from "@/lib/auth/guards";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { AI_MODELS } from "@/lib/ai-models";
import { buildSystemPrompt } from "@/lib/agent/prompt";
import { getWorkspaceAiKey } from "@/lib/integrations/ai-keys";
import { getFile } from "@/lib/storage/blob";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Attachment = { url: string; kind: "image" | "pdf" };
type Result = { reply: string; error?: undefined } | { reply?: undefined; error: string };
type TranscribeResult = { text: string; error?: undefined } | { text?: undefined; error: string };

export async function testAgentChat(agentId: string, history: ChatMessage[], message: string, attachment?: Attachment | null): Promise<Result> {
  const ctx = await requireAdminCtx();
  await assertOwns("agent", agentId, ctx.workspace.id);
  const agent = await prisma.aIAgent.findUnique({
    where: { id: agentId },
    include: { workspace: { select: { name: true } } },
  });
  if (!agent) return { error: "Agente no encontrado." };

  const apiKey = (await getWorkspaceAiKey(agent.workspaceId, "ANTHROPIC")) ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "Configura una API key de Anthropic en Integraciones (o ANTHROPIC_API_KEY en .env.local) para probar el bot." };
  }

  const knowledgeItems = agent.knowledgeBaseIds.length
    ? await prisma.knowledgeBaseItem.findMany({ where: { knowledgeBaseId: { in: agent.knowledgeBaseIds } } })
    : [];

  const system = buildSystemPrompt(
    { ...agent, actions: agent.actions, actionsConfig: (agent.actionsConfig ?? {}) as Record<string, unknown> },
    agent.workspace.name,
    knowledgeItems
  );

  const userContent: Anthropic.Messages.ContentBlockParam[] = [];
  if (attachment) {
    if (attachment.kind === "image") {
      userContent.push({ type: "image", source: { type: "url", url: attachment.url } });
    } else {
      userContent.push({ type: "document", source: { type: "url", url: attachment.url } });
    }
  }
  if (message) userContent.push({ type: "text", text: message });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: agent.model in AI_MODELS ? agent.model : "claude-sonnet-5",
      max_tokens: 1024,
      system,
      messages: [...history, { role: "user", content: userContent }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    return { reply: textBlock?.type === "text" ? textBlock.text : "" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { error: `No se pudo contactar al modelo: ${msg}` };
  }
}

export async function transcribeVoiceNote(audioUrl: string): Promise<TranscribeResult> {
  await requireAdminCtx();
  if (!process.env.OPENAI_API_KEY) {
    return { error: "Configura OPENAI_API_KEY en .env.local para transcribir notas de voz." };
  }
  try {
    // Solo audios propios (subidos a /api/files/voice-notes/…): se leen directo del almacenamiento,
    // nunca con un fetch a una URL arbitraria del cliente (SSRF hacia la red interna).
    const key = new URL(audioUrl, "http://local").pathname.replace(/^\/api\/files\//, "");
    if (!key.startsWith("voice-notes/") || key.includes("..")) return { error: "Audio no válido." };
    const stored = await getFile(key);
    if (!stored.body) return { error: "No se pudo leer el audio para transcribir." };
    const bytes = await stored.body.transformToByteArray();
    const type = stored.contentType || "audio/webm";
    const file = new File([Buffer.from(bytes)], "nota-voz.webm", { type });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcription = await client.audio.transcriptions.create({ file, model: "whisper-1" });
    return { text: transcription.text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { error: `No se pudo transcribir el audio: ${msg}` };
  }
}
