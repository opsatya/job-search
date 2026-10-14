import { OllamaProvider } from "../../src/llm/ollama-provider";

// Ollama's streaming /api/generate returns NDJSON: one chunk per line, each
// carrying a fragment of `response`, with the final `done: true` chunk
// carrying done_reason and token counts.
function ndjsonResponse(
  fragments: string[],
  final: Record<string, unknown> = { done_reason: "stop", prompt_eval_count: 100, eval_count: 20 },
  status = 200,
): Response {
  const lines = [
    ...fragments.map((response) => JSON.stringify({ response, done: false })),
    JSON.stringify({ response: "", done: true, ...final }),
  ];
  return new Response(lines.join("\n") + "\n", { status });
}

const BASE = { baseUrl: "http://127.0.0.1:11434", model: "llama3.1" };

describe("OllamaProvider", () => {
  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(ndjsonResponse(['{"answer"', ": 42}"])) as unknown as typeof fetch;
  });

  it("streams the prompt and schema to /api/generate with an explicit context size and parses the joined response", async () => {
    const provider = new OllamaProvider(BASE);

    const schema = { type: "object", properties: { answer: { type: "number" } } };
    const result = await provider.generateStructured<{ answer: number }>("What is 6*7?", schema);

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "llama3.1",
          prompt: "What is 6*7?",
          format: schema,
          // Streaming so response headers arrive immediately — a non-streamed
          // request on slow local hardware hits Node fetch's 300s headers
          // timeout before Ollama has generated anything to send.
          stream: true,
          options: { num_ctx: 8192 },
        }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result).toEqual({ answer: 42 });
  });

  it("uses a configured context size", async () => {
    const provider = new OllamaProvider({ ...BASE, numCtx: 16384 });
    await provider.generateStructured("prompt", {});

    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.options).toEqual({ num_ctx: 16384 });
  });

  it("throws when Ollama returns a non-JSON response body", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(ndjsonResponse(["not json"]));
    const provider = new OllamaProvider(BASE);

    await expect(provider.generateStructured("prompt", {})).rejects.toThrow(/failed to parse/i);
  });

  it("throws on a non-2xx HTTP status", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response("model not found", { status: 404 }),
    );
    const provider = new OllamaProvider(BASE);

    await expect(provider.generateStructured("prompt", {})).rejects.toThrow(/404/);
  });

  it("throws when generation stopped for any reason other than a natural stop", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      ndjsonResponse(['{"answer": 42}'], {
        done_reason: "length",
        prompt_eval_count: 100,
        eval_count: 20,
      }),
    );
    const provider = new OllamaProvider(BASE);

    await expect(provider.generateStructured("prompt", {})).rejects.toThrow(/done_reason=length/);
  });

  it("throws when prompt + output filled the context window, since Ollama silently discards tokens on overflow", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      ndjsonResponse(['{"answer": 42}'], {
        done_reason: "stop",
        prompt_eval_count: 4000,
        eval_count: 96,
      }),
    );
    const provider = new OllamaProvider({ ...BASE, numCtx: 4096 });

    await expect(provider.generateStructured("prompt", {})).rejects.toThrow(/context window/i);
  });
});
