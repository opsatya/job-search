import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface OpenClawSessionOptions {
  model: string;
  tools: string[];
  prompt: string;
}

// openclaw's tool allowlist is process-wide CLI config (`openclaw config set`),
// not a per-invocation flag (verified in Task 11's spike) — set it once per
// distinct tool set rather than shelling out before every single call.
let lastConfiguredTools: string | null = null;

async function ensureToolAllowlist(tools: string[]): Promise<void> {
  const key = JSON.stringify(tools);
  if (lastConfiguredTools === key) return;
  await execFileAsync("npx", ["openclaw", "config", "set", "tools.allow", key, "--strict-json"]);
  lastConfiguredTools = key;
}

export async function runOpenClawSession(options: OpenClawSessionOptions): Promise<string> {
  await ensureToolAllowlist(options.tools);

  const { stdout } = await execFileAsync(
    "npx",
    [
      "openclaw", "agent", "--local",
      "--to", "+10000000000",
      "--message", options.prompt,
      "--model", options.model,
      "--json",
      "--timeout", "120",
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  const parsed = JSON.parse(stdout);
  // Verified via a live probe (see task-12-report.md): the `--json` output's
  // top-level shape is `{ payloads: [{ text, mediaUrl }], meta: {...} }`, and
  // on a pure-text (no-tool-call) response, the model's final reply is
  // `payloads[0].text`. Confirmed directly against a real `openclaw agent
  // --local ... --json` invocation, not inferred from docs.
  const finalText: unknown = parsed?.payloads?.[0]?.text;
  if (typeof finalText !== "string") {
    throw new Error(`Could not locate final assistant text in OpenClaw --json output: ${stdout.slice(0, 500)}`);
  }
  return finalText;
}
