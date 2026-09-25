# OpenClaw Headless Spike — Findings

Date: 2026-09-25
Result: PASS

## What was tried

### Step 1: Install

```bash
cd BE
npm install openclaw
npx openclaw --version
```

Installed cleanly (376 packages added; one `EBADENGINE` warning for a transitive
`undici` dep expecting Node >=22.19.0 vs. local Node 22.17.0 — non-fatal).

```
OpenClaw 2026.5.12 (f066dd2)
```

`BE/package.json` now has `"openclaw": "^2026.5.12"` under dependencies;
`BE/package-lock.json` updated accordingly.

### Step 2: CLI help / non-interactive mode

```bash
npx openclaw --help
npx openclaw agent --help
npx openclaw gateway --help
```

Key finding: `openclaw agent --local` runs **"the embedded agent locally"**
— i.e. it does NOT require the WebSocket Gateway daemon to be running. Relevant
flags found on `agent`:

- `--local` — run embedded (no Gateway process needed)
- `-m/--message <text>` — single prompt, not a chat/TUI session
- `--model <id>` — `provider/model` override (e.g. `ollama/qwen2.5:0.5b`)
- `--json` — machine-readable structured output
- `--timeout <seconds>` — per-run timeout (default 600s)
- `--to <e164>` — only used to derive a session key; no actual channel delivery
  happens unless `--deliver` is also passed
- No per-invocation `--tools` flag exists. Tool scoping instead lives in
  **config** (`openclaw config set tools.allow '[...]'` or
  `tools.profile`/`tools.deny`/`tools.byProvider`), confirmed via
  `openclaw config schema` (`tools.allow` = "Absolute tool allowlist that
  replaces profile-derived defaults for strict environments") and via
  `openclaw sandbox explain --json` / `openclaw doctor`, both of which report
  the effective tool set.

There is no dedicated `run` subcommand as the brief speculated; `agent --local`
is the real single-task, non-interactive surface.

### Step 3: Model provider (Ollama)

Ollama was auto-detected with zero config: `openclaw models status --json`
already showed an `ollama:default` auth profile
(`marker(ollama-local)`) before any manual provider setup, consistent with
`docs.openclaw.ai/concepts/model-providers`' claim that Ollama at
`127.0.0.1:11434` is auto-detected.

Environment caveat: `ollama list` was actually **empty** at spike start —
`llama3.1` was not pre-pulled despite the task brief's assumption. `ollama pull
llama3.1` (4.9 GB) was started but, at the sandbox's throttled/variable network
speed (0.3–5 MB/s), would have taken 15–30+ min, blowing the timebox. Pulled
`qwen2.5:0.5b` (397 MB) instead, which finished in a few minutes, and used it
for the live invocation test. This substitution only affects model quality/
output content, not the mechanism being tested (headless invocation, tool
scoping, clean exit) — the `--model` flag takes any `provider/model` id, so
swapping in `ollama/llama3.1` later is a one-flag change once it's pulled.

```bash
npx openclaw setup                              # baseline config, no wizard, no hang
npx openclaw config set tools.allow '["exec"]' --strict-json
npx openclaw models set ollama/qwen2.5:0.5b
```

(`npx openclaw onboard --non-interactive --accept-risk --auth-choice ollama ...`
was also tried first but hung indefinitely with no output/exit after 2+
minutes and was killed; `openclaw setup` + `config set` + `models set` is the
faster, reliable non-interactive path and is what actually got used.)

`openclaw doctor` confirmed the allowlist took effect before any live call:

```
- tools: filesystem write tools are disabled, but exec is still available.
  Runtime tools: exec; disabled filesystem tools: write, edit, apply_patch.
```

### Step 4: Headless invocation with a scoped tool

Used the built-in `exec` tool (scoped via `tools.allow: ["exec"]` above) in
place of a hand-written `echo_input` plugin tool — full plugin-SDK
authoring was out of scope for the ~1hr timebox and `exec` running a plain
`echo` is functionally the same trivial-tool-call test the brief describes.

```bash
npx openclaw agent --local \
  --to +15555550123 \
  --message "Run the shell command: echo hello-openclaw-spike" \
  --model ollama/qwen2.5:0.5b \
  --json --timeout 60
```

Result: process ran once and exited after ~57s (`durationMs: 56772`, wall
clock `1:00.53`, no `--deliver` so nothing was sent to any channel). `--json`
output included a full structured trace. `ps aux | grep openclaw` after exit
showed **no lingering process** — clean exit confirmed.

The session transcript (`~/.openclaw/agents/main/sessions/<id>.jsonl`) shows
the actual tool call and result:

```json
{"role":"assistant","content":[{"type":"toolCall","name":"exec",
  "arguments":{"command":"echo hello-openclaw-spike"}}], "stopReason":"toolUse"}
{"role":"toolResult","toolName":"exec",
  "content":[{"type":"text","text":"hello-openclaw-spike"}],
  "details":{"status":"completed","exitCode":0,"durationMs":11}}
```

And the `--json` response's `systemPromptReport.tools.entries` confirms only
one tool was ever exposed to the model:

```json
"tools": { "listChars": 0, "schemaChars": 1187,
  "entries": [ { "name": "exec", "summaryChars": 446, "schemaChars": 1187, "propertiesCount": 12 } ] }
```

and `toolSummary`: `{"calls": 1, "tools": ["exec"], "failures": 0}`.

The final chit-chat reply from `qwen2.5:0.5b` ("Greetings! I'm openclaw...")
is generic/weak — an artifact of using a 0.5B model for a spike, not a defect
in the invocation mechanism. The tool call itself was correct, scoped, and
successful.

## Decision

**PASS** — headless, single-task, scoped-tool invocation works via
`openclaw agent --local --message "..." --model <provider/model> --json`,
with tool scoping enforced through config (`tools.allow`), no Gateway daemon
running, no channel/chat UI, and a confirmed clean process exit.

PASS -> proceed with Task 12A (OpenClaw analysis integration)

## Notes for Phase B (LinkedIn/Naukri browser-driven source)

- OpenClaw has an explicit `browser` tool (seen in the sandbox tool
  deny-list defaults: `openclaw sandbox explain --json` lists `browser`,
  `canvas`, `nodes`, `cron`, `gateway` among tools denied-by-default in
  sandboxed mode but present in the broader tool catalog) — i.e. browser
  automation is a first-class tool type, not something to bolt on. It will
  need to be explicitly allow-listed (`tools.allow` / `tools.alsoAllow`)
  for a Phase B session, the same mechanism verified here for `exec`.
- `openclaw sandbox` (Docker-based agent isolation) and `openclaw sandbox
  explain --agent/--session` are the right tools to inspect/harden the
  effective tool policy before running a browser-capable session — useful
  for isolating LinkedIn/Naukri credentials and browser state per agent.
- Session model: `agent --local` creates a session file per run under
  `~/.openclaw/agents/<agent>/sessions/<uuid>.jsonl` even in "headless"
  mode — there is no truly session-less mode, but a fresh `--session-id`
  (or omitting it, as done here) gives a new isolated session each call,
  which is what Phase A/B need (no shared conversational state bleeding
  between runs).
- `--to <e164>` is required today to derive a session key even for a local,
  non-delivered run; it does not need to be a real number and no message is
  sent unless `--deliver` is also passed. This is a slightly awkward but
  harmless CLI quirk to carry into Task 12A's shell-out code.
- Model/provider auth for Ollama is genuinely zero-config (auto-detected at
  `127.0.0.1:11434`); no API keys or `--anthropic-api-key`-style flags
  needed for the local-Ollama path.
- `openclaw onboard --non-interactive` hung indefinitely in this sandbox
  (network-dependent step, exact cause not root-caused given the timebox);
  `openclaw setup` (no wizard) + `openclaw config set` + `openclaw models
  set` is the reliable non-interactive bootstrap sequence and is what
  Task 12A's setup/CI code should use instead of `onboard --non-interactive`.
