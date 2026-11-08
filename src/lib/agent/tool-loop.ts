import type Anthropic from "@anthropic-ai/sdk";

export const MAX_TOOL_ITERATIONS = 4;

export type ToolLoopResult = {
  finalText: string;
  toolCalls: string[];
  totalInputTokens: number;
  totalOutputTokens: number;
  /** Tamaño real del contexto en la última llamada al modelo (entrada + caché), para decidir cuándo compactar. */
  lastInputTokens: number;
};

/** Lo que devuelve executeToolCall por cada tool_use — terminal corta el loop y usa terminalMessage como respuesta final, sin dejar que el modelo lo parafrasee. */
export type ToolCallOutcome = { content: string; terminal?: boolean; terminalMessage?: string };

export class ToolLoopError extends Error {
  constructor(message: string, public totalInputTokens: number, public totalOutputTokens: number) {
    super(message);
  }
}

/**
 * Loop de tool-calling compartido entre el agente conversacional (runAgentTurn)
 * y el paso autónomo de automatizaciones (AI_AGENT_STEP). Muta `messages` in-place
 * a medida que avanza — el llamador decide qué hacer con ellos después.
 */
export async function runToolCallingLoop(params: {
  client: Anthropic;
  model: string;
  system: string | Anthropic.Messages.TextBlockParam[];
  tools: Anthropic.Tool[];
  messages: Anthropic.Messages.MessageParam[];
  executeToolCall: (block: Anthropic.Messages.ToolUseBlock) => Promise<ToolCallOutcome>;
  maxIterations?: number;
}): Promise<ToolLoopResult> {
  const { client, model, system, tools, messages, executeToolCall } = params;
  const maxIterations = params.maxIterations ?? MAX_TOOL_ITERATIONS;

  const toolCallLog: string[] = [];
  let finalText = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastInputTokens = 0;

  for (let i = 0; i < maxIterations; i++) {
    let response: Anthropic.Messages.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: 1024,
        system,
        tools: tools.length ? tools : undefined,
        messages,
      });
    } catch (e) {
      throw new ToolLoopError(
        `No se pudo contactar al modelo: ${e instanceof Error ? e.message : "error desconocido"}`,
        totalInputTokens,
        totalOutputTokens
      );
    }
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
    lastInputTokens = response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0);

    const toolUseBlocks = response.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");
    const textBlocks = response.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text");
    finalText = textBlocks.map((b) => b.text).join("\n").trim();

    if (toolUseBlocks.length === 0) break;

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    let terminalMessage: string | null = null;

    for (const block of toolUseBlocks) {
      toolCallLog.push(block.name);
      const outcome = await executeToolCall(block);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: outcome.content });
      if (outcome.terminal) terminalMessage = outcome.terminalMessage ?? outcome.content;
    }
    messages.push({ role: "user", content: toolResults });

    if (terminalMessage) {
      finalText = terminalMessage;
      break;
    }
  }

  return { finalText, toolCalls: toolCallLog, totalInputTokens, totalOutputTokens, lastInputTokens };
}
