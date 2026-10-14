import type { LLMProvider } from "./provider";

export interface OllamaProviderOptions {
  baseUrl: string;
  model: string;
  // Ollama defaults to a 4096-token context and, on overflow, silently
  // discards tokens (including the instructions at the top of the prompt)
  // rather than erroring — so this is always sent explicitly.
  numCtx?: number;
  timeoutMs?: number;
}

const DEFAULT_NUM_CTX = 8192;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

interface OllamaChunk {
  response?: string;
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

export class OllamaProvider implements LLMProvider {
  constructor(private readonly options: OllamaProviderOptions) {}

  async generateStructured<T>(prompt: string, schema: object): Promise<T> {
    const numCtx = this.options.numCtx ?? DEFAULT_NUM_CTX;

    // Streamed so response headers arrive immediately: a non-streamed request
    // on slow local hardware hits Node fetch's built-in 300s headers timeout
    // before Ollama has finished generating. The overall bound is ours.
    const response = await fetch(`${this.options.baseUrl}/api/generate`, {
      method: "POST",
      body: JSON.stringify({
        model: this.options.model,
        prompt,
        format: schema,
        stream: true,
        options: { num_ctx: numCtx },
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Ollama request failed with HTTP ${response.status}: ${body}`);
    }

    let text = "";
    let final: OllamaChunk | undefined;
    for (const line of body.split("\n")) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line) as OllamaChunk;
      if (chunk.error) throw new Error(`Ollama error: ${chunk.error}`);
      text += chunk.response ?? "";
      if (chunk.done) final = chunk;
    }

    if (final?.done_reason !== "stop") {
      throw new Error(
        `Ollama generation did not finish cleanly (done_reason=${final?.done_reason})`,
      );
    }
    const usedTokens = (final.prompt_eval_count ?? 0) + (final.eval_count ?? 0);
    if (usedTokens >= numCtx) {
      throw new Error(
        `Ollama prompt + output (${usedTokens} tokens) filled the ${numCtx}-token context window; output is unreliable`,
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse Ollama response as JSON: ${text}`);
    }
  }
}
