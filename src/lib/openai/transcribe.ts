import OpenAI from "openai";
import { getWorkspaceAiKey } from "@/lib/integrations/ai-keys";

/** Transcribe un audio (por URL) con Whisper — usa la key propia del workspace si existe, si no la compartida. */
export async function transcribeAudioUrl(workspaceId: string, audioUrl: string): Promise<string | null> {
  const apiKey = (await getWorkspaceAiKey(workspaceId, "OPENAI")) ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) return null;
  const blob = await audioRes.blob();
  const file = new File([blob], "audio.ogg", { type: blob.type || "audio/ogg" });

  const client = new OpenAI({ apiKey });
  const transcription = await client.audio.transcriptions.create({ file, model: "whisper-1" });
  return transcription.text || null;
}
