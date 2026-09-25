import { OllamaProvider } from "../../src/llm/ollama-provider";

describe("OllamaProvider", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: '{"answer": 42}' }),
    }) as unknown as typeof fetch;
  });

  it("sends the prompt and schema to Ollama's /api/generate and parses the JSON response", async () => {
    const provider = new OllamaProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "llama3.1",
    });

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
          stream: false,
        }),
      }),
    );
    expect(result).toEqual({ answer: 42 });
  });

  it("throws when Ollama returns a non-JSON response body", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: "not json" }),
    });
    const provider = new OllamaProvider({ baseUrl: "http://127.0.0.1:11434", model: "llama3.1" });

    await expect(provider.generateStructured("prompt", {})).rejects.toThrow(
      /failed to parse/i,
    );
  });
});
