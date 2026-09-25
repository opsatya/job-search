import { execFile } from "node:child_process";
import { runOpenClawSession } from "../../src/agent/openclaw-client";

jest.mock("node:child_process", () => ({
  execFile: jest.fn(),
}));

const mockExecFile = execFile as unknown as jest.Mock;

type ExecFileCallback = (
  err: Error | null,
  result: { stdout: string; stderr: string },
) => void;

// mockExecFile has no `util.promisify.custom` implementation (unlike the real
// node:child_process.execFile), so `promisify(execFile)` falls back to
// default behavior: the callback's second argument becomes the resolved
// value. The real code destructures `{ stdout }` from that value, so the
// callback must be invoked with a single `{ stdout, stderr }` object.
function respondOk(text: string) {
  mockExecFile.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as ExecFileCallback;
    callback(null, {
      stdout: JSON.stringify({ payloads: [{ text, mediaUrl: null }] }),
      stderr: "",
    });
  });
}

function respondWithStdout(stdout: string) {
  mockExecFile.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as ExecFileCallback;
    callback(null, { stdout, stderr: "" });
  });
}

describe("runOpenClawSession", () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it("constructs the config-set and agent invocation commands with the expected flags and order", async () => {
    respondOk("hello");

    await runOpenClawSession({
      model: "ollama/llama3.1",
      tools: ["probe-command-test"],
      prompt: "Analyze this job",
    });

    expect(mockExecFile).toHaveBeenNthCalledWith(
      1,
      "npx",
      [
        "openclaw",
        "config",
        "set",
        "tools.allow",
        JSON.stringify(["probe-command-test"]),
        "--strict-json",
      ],
      expect.any(Function),
    );
    expect(mockExecFile).toHaveBeenNthCalledWith(
      2,
      "npx",
      [
        "openclaw", "agent", "--local",
        "--to", "+10000000000",
        "--message", "Analyze this job",
        "--model", "ollama/llama3.1",
        "--json",
        "--timeout", "120",
      ],
      { maxBuffer: 10 * 1024 * 1024 },
      expect.any(Function),
    );
  });

  it("extracts payloads[0].text from the JSON stdout as the final assistant reply", async () => {
    respondOk("the-final-reply");

    const result = await runOpenClawSession({
      model: "ollama/llama3.1",
      tools: ["extract-test"],
      prompt: "hi",
    });

    expect(result).toBe("the-final-reply");
  });

  it("throws when payloads[0].text is missing from the JSON stdout", async () => {
    respondWithStdout(JSON.stringify({ payloads: [] }));

    await expect(
      runOpenClawSession({ model: "ollama/llama3.1", tools: ["missing-text-test"], prompt: "hi" }),
    ).rejects.toThrow(/Could not locate final assistant text/);
  });

  it("sets the tool allowlist exactly once across repeated calls with the same tools array", async () => {
    respondOk("ok");
    const tools = ["memo-test-a"];

    await runOpenClawSession({ model: "ollama/llama3.1", tools, prompt: "one" });
    await runOpenClawSession({ model: "ollama/llama3.1", tools, prompt: "two" });

    const configSetCalls = mockExecFile.mock.calls.filter(
      (call) => Array.isArray(call[1]) && call[1][1] === "config" && call[1][4] === JSON.stringify(tools),
    );
    expect(configSetCalls).toHaveLength(1);
    // 1 config-set call + 2 agent invocations = 3 total execFile calls.
    expect(mockExecFile).toHaveBeenCalledTimes(3);
  });

  it("re-sets the tool allowlist when a different tools array is used", async () => {
    respondOk("ok");

    await runOpenClawSession({ model: "ollama/llama3.1", tools: ["change-test-a"], prompt: "one" });
    await runOpenClawSession({ model: "ollama/llama3.1", tools: ["change-test-b"], prompt: "two" });

    const configSetCalls = mockExecFile.mock.calls.filter(
      (call) => Array.isArray(call[1]) && call[1][1] === "config",
    );
    expect(configSetCalls).toHaveLength(2);
    // 2 config-set calls + 2 agent invocations = 4 total execFile calls.
    expect(mockExecFile).toHaveBeenCalledTimes(4);
  });
});
