import type { LLMProvider } from "./provider";

export interface OllamaProviderOptions {
  baseUrl: string;
  model: string;
}

export class OllamaProvider implements LLMProvider {
  constructor(private readonly options: OllamaProviderOptions) {}

  async generateStructured<T>(prompt: string, schema: object): Promise<T> {
    const response = await fetch(`${this.options.baseUrl}/api/generate`, {
      method: "POST",
      body: JSON.stringify({
        model: this.options.model,
        prompt,
        format: schema,
        stream: false,
      }),
    });

    const data = (await response.json()) as { response: string };

    try {
      return JSON.parse(data.response) as T;
    } catch {
      throw new Error(`Failed to parse Ollama response as JSON: ${data.response}`);
    }
  }
}
