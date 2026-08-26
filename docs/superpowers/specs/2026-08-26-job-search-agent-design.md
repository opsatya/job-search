# Job Search Agent — Phase 0 Design

Status: approved for spec, pending implementation plan
Branch: `feature/agent`
Source requirements: `Job Search Agent — Current Phase Requirements for Claude Code.md`

## 1. Purpose

A personal AI-powered job discovery and matching agent for Satyajeet Singh. This phase proves one loop works end to end:

```
User Profile → Job Search → Collection → Normalization → Deduplication
→ Hard Filtering → LLM Analysis → Match Score → Ranked Results → User
```

It is explicitly not an application bot. The agent finds, analyzes, and ranks jobs; the user decides what to apply to. No automatic applications, no recruiter outreach, no LinkedIn login automation, no anti-bot bypass — these remain out of scope for this phase (see §9).

## 2. Architecture

```
CLI (agent:run)
   │
   ▼
Pipeline (TypeScript — deterministic, fixed step order)
   │
   ├─ Load candidate profile (Postgres)
   ├─ Load search configuration (Postgres/JSON)
   ├─ JobSource.search() — Greenhouse (Phase A), then LinkedIn/Naukri (Phase B, §13)
   ├─ Normalize → canonical Job
   ├─ Deduplicate (sourceJobId / canonical URL / company+title+location)
   ├─ Hard filters (seniority exclusions, role-keyword inclusion)
   ├─ For each surviving job → OpenClaw agent call (analysis step only)
   │       tool allowlist: get_candidate_profile, analyze_job
   │       model: ollama/llama3.1
   │       returns: structured JSON match analysis
   ├─ Deterministic weighted score (§8 formula, computed in our code — never by the LLM)
   └─ Persist (jobs, job_matches, agent_runs) via Prisma
   │
   ▼
CLI output: ranked matches
```

### Why the LLM/agent boundary is drawn where it is

The source requirements' own architecture diagram (its §4) shows OpenClaw sitting above all tools (search, analysis, profile), which would let an LLM-driven agent dynamically decide step order. But the same document also states "do NOT make the LLM responsible for the entire application" (its §3) and gives a fixed, deterministic step order while saying "do not create a complicated autonomous loop" (its §22). These two framings conflict if taken literally together.

This design resolves it by scoping OpenClaw's *LLM reasoning* to the analysis step only: our TypeScript code drives the fixed pipeline end to end (search → normalize → dedupe → filter → score → persist), and OpenClaw's tool-calling agent is invoked narrowly, once per job that survives filtering, to produce the structured semantic match analysis. The weighted score formula always runs in our code, never inside the LLM call. This keeps the pipeline deterministic, testable, and debuggable, while still giving OpenClaw the one job that genuinely needs LLM judgment.

OpenClaw is used a second, separate way in this phase: as the browser-driving mechanism for the LinkedIn/Naukri source (§4). That usage has nothing to do with LLM reasoning — it's OpenClaw's browser capability navigating a real Chrome session to run a search and extract structured data, more analogous to Greenhouse's API call than to the analysis step. It gets its own narrow tool/capability scope (browser navigation + extraction only) independent of the analysis session's allowlist.

### OpenClaw — verified facts (2026-08-26)

OpenClaw (`github.com/openclaw/openclaw`, npm package `openclaw`, actively released — latest `2026.7.1-2` at time of writing) is a real, actively maintained personal-AI-assistant project with a Gateway control plane, channel integrations (WhatsApp/Telegram/Slack/Discord/etc.), a TypeScript plugin/tool SDK, and a plugin marketplace (ClawHub). Confirmed relevant to this project:

- **Ollama support**: native, auto-detected at `127.0.0.1:11434`. Models referenced as `ollama/<model>`, e.g. `ollama/llama3.1`.
- **Custom tools**: registerable via its plugin/tool SDK.
- **Cron**: listed as a first-class capability, usable for the later scheduled-run milestone.
- **Sandboxing**: documented; tools run on-host by default unless sandboxing is configured.

Not yet verified: whether OpenClaw can be invoked headlessly for a single scoped task (no channel, no persistent session) and cleanly exit with structured output, versus requiring its full Gateway/session model to be running. This is the one real architectural unknown on the analysis side and is deliberately sequenced as an early Phase A task in Milestone 1 (§13) — a cheap spike before the rest of the pipeline is built assuming a particular integration shape. If headless invocation proves awkward, the fallback is calling Ollama directly through the `LLMProvider` interface (§6) for this phase, and revisiting OpenClaw integration once its non-interactive story is clearer.

## 3. Candidate Profile

Seeded from the source requirements' §6 JSON (name, education, experience, primary/secondary target roles, skills by category, location/salary/company preferences). Stored in `candidate_profile`, editable later (no edit UI in this phase).

Positioning: an early-career software engineer with production full-stack experience — not a "fresher with no experience," and not exaggerated as senior. This framing feeds directly into the LLM analysis prompt so match reasoning doesn't over- or under-sell the candidate.

## 4. Job Sources

### Tier 1 (Milestone 1 and near-term follow-up) — public APIs, no auth, no ToS conflict

- **Greenhouse** (`boards-api.greenhouse.io`) — Milestone 1's only source. Public, unauthenticated JSON API designed for embedding job boards.
- **Lever** (`api.lever.co`) — same category, added once Greenhouse proves the pattern.
- **Workable**, **company career pages** — tier 2, added opportunistically.

### LinkedIn / Naukri — in scope for Milestone 1, sequenced after Greenhouse, explicitly risk-flagged

The source requirements' own §11 says "do not automate authenticated LinkedIn activity" and lists a "LinkedIn login bot" under things not to build, scoping Tier 1 specifically to sources that don't require impersonating a browser session. Mid-brainstorm, the user asked for OpenClaw to also browse LinkedIn and Naukri for discovery — which conflicts with that constraint, since both platforms' Terms of Service prohibit automated access regardless of intent, and a scheduled/cron-driven pattern is exactly what anti-bot systems are built to catch (account suspension / IP ban risk).

Resolution agreed with the user: this is built as light-touch personal browsing through the user's own logged-in Chrome session, at low frequency, behaving like a human clicking through search results — no proxy rotation, no browser-fingerprint spoofing, no CAPTCHA-solving, no scraping-detection evasion of any kind. It is a **separate `JobSource` implementation**, driven by OpenClaw's browser capability rather than an HTTP client. Per the user's explicit direction, it is **in scope for Milestone 1** — but sequenced strictly after the Greenhouse-based pipeline is built and verified working end to end (§13), not built in parallel with it. That ordering exists so a stall or breakage in browser automation (the more fragile, higher-uncertainty piece) never leaves Milestone 1 with nothing working. This remains a real account/ToS risk even in its light-touch form; it is the user's own account and own risk tolerance, not mass scraping of third parties.

### Source abstraction

```typescript
interface JobSource {
  name: string;
  search(params: JobSearchParams): Promise<RawJob[]>;
  fetchJob?(url: string): Promise<RawJob>;
  healthCheck?(): Promise<boolean>;
}
```

Every source returns data normalized into the same canonical `Job` shape (source requirements' §13). Nothing downstream of normalization is coupled to any one source.

## 5. Normalized Job Object

As specified in the source requirements' §13 — `Job` interface with `id`, `source`, `sourceJobId`, `company`, `title`, `description`, `url`, `locations`, `remote`, `employmentType`, `experienceMin/Max`, `salaryMin/Max/Currency`, `technologies`, `postedAt`, `discoveredAt`, `status`, `matchScore`.

## 6. LLM Provider Abstraction

```typescript
interface LLMProvider {
  generateStructured<T>(prompt: string, schema: unknown): Promise<T>;
}
```

`OllamaProvider` is the initial implementation, configured via `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL=llama3.1` (confirmed installed locally). Not hard-coded — replaceable later with OpenAI/Gemini/Anthropic/OpenRouter/another local model. This interface exists independently of the OpenClaw integration so the LLM call can be made directly if the OpenClaw headless spike (§10) doesn't pan out.

## 7. Database

PostgreSQL (already available locally) + Prisma. Initial tables: `candidate_profile`, `jobs`, `job_matches`, `agent_runs`, `applications` (schema per source requirements' §14). No vector database, no RAG infrastructure this phase.

## 8. Deduplication, Filtering, Scoring

- **Deduplication**: multi-signal — `sourceJobId`, canonical URL, company, normalized title, location. Running `agent:run` twice must not create duplicate rows.
- **Deterministic filtering** (pre-LLM, to reduce unnecessary calls): reject senior/staff/principal/lead/manager/director/architect/10+ years unless explicitly allowed; reject clearly unrelated roles (data scientist/analyst, QA-only, DevOps-only, PM, design, sales); keep junior/entry/graduate/associate/full-stack/backend/frontend/Node.js/React/TypeScript-flavored titles.
- **LLM analysis**: for every job surviving filtering, send candidate profile + title/company/location/salary/description; require structured JSON (`technicalMatch`, `roleMatch`, `experienceMatch`, `locationMatch`, `salaryMatch`, `strengths`, `gaps`, `risks`, `recommendation`, `reason`).
- **Anti-hallucination rule**: the LLM must never infer a skill from a related one (e.g., REST ≠ GraphQL, AWS ≠ Kubernetes/Terraform/EKS). Ungrounded skills are reported as "not demonstrated," not assumed.
- **Scoring formula** (always computed in our code, never by the LLM):

```
overallScore =
  technicalMatch * 0.30 +
  roleMatch * 0.20 +
  experienceMatch * 0.15 +
  productionMatch * 0.10 +
  locationMatch * 0.10 +
  salaryMatch * 0.10 +
  companyMatch * 0.05
```

- **Categories**: 90–100 Excellent, 80–89 Strong, 70–79 Good, 60–69 Possible, <60 Low Priority. Daily results surface Excellent/Strong primarily, optionally interesting 70–79s.
- **Salary is not a hard filter**: a below-floor opportunity can still surface if company/role/engineering-exposure/growth are strong; the LLM analysis explains this rather than the pipeline silently dropping it.

## 9. Security Boundaries

Job descriptions are untrusted external content. They are passed into the OpenClaw analysis call strictly as tool-call *data*, never concatenated into anything resembling an instruction. The OpenClaw session for this step has a tool allowlist of exactly two read-oriented tools (`get_candidate_profile`, `analyze_job`) — it cannot reach `save_job` or any write-capable tool, so no adversarial job description can trigger an unintended write. No shell execution, no filesystem access, no env/secrets access, no arbitrary tool calls are exposed to the agent. Postgres credentials via env, never committed.

Explicitly not built this phase: automatic applications, LinkedIn/Naukri automation beyond the light-touch personal-browsing carve-out in §4, CAPTCHA bypass, anti-bot bypass, recruiter messaging, multi-agent swarms, vector DB/RAG, Kubernetes, mobile app, complex memory/planning frameworks.

## 10. Repository Structure

Two sibling packages, not a formal Turborepo/pnpm-workspace monorepo (no shared build tooling needed yet — that would be premature structure for two independently-runnable things):

```
BE/                backend: pipeline, sources, agent, db — all of Milestone 1's work
  src/
    cli/           agent:run entrypoint
    pipeline/      orchestrator, hard-filter rules, dedup, scoring formula
    sources/       JobSource interface + greenhouse/, linkedin/, naukri/
    agent/         OpenClaw integration: analysis tool definitions + browser-driven search
    llm/           LLMProvider interface + OllamaProvider
    db/            Prisma schema + client
    config/        candidate profile seed, search config
  prisma/
    schema.prisma

FE/                dashboard — already scaffolded (Vite + React 19 + TypeScript + oxlint)
  src/             untouched until the dashboard milestone (§13); reserved, not built against yet
```

`FE/` was scaffolded by the user ahead of this plan and is left as-is for now — it becomes live in a future dashboard milestone, once there's pipeline data worth displaying (source requirements' §26), not during Milestone 1. `BE/` stack: Node.js LTS, TypeScript, Prisma, Zod, Jest (org standard), ESLint + Prettier. No Fastify yet — Milestone 1 is CLI-only, no HTTP server needed until BE needs to serve the dashboard.

## 11. Testing Strategy

Dedup logic, hard filters, and the scoring formula are pure functions, fully unit-tested without DB/network dependencies. `JobSource` and the OpenClaw agent call are mocked in pipeline tests. A small set of integration tests run against a real (test) Postgres via Prisma. Running the agent twice in an integration test must assert zero duplicate job rows.

## 12. Error Handling

Each pipeline stage is a typed async function; stages don't reach into each other's internals. Per-source fetch failures are caught individually — one source failing doesn't kill the run — and reflected in `agent_runs`. OpenClaw analysis failures (malformed JSON, timeout) fall back to `recommendation: "needs_review"` rather than crashing the run or dropping the job; the job is still saved with `status: "new"` and null score fields so nothing is silently lost.

## 13. Milestone 1 Scope

**Phase A — Greenhouse path (build and verify first):**

1. Repo scaffold (`BE/`: TypeScript, ESLint/Prettier, Jest) on `feature/agent`.
2. Prisma schema + migration (5 tables from §7) against the existing local Postgres.
3. Candidate profile seeded from §3/source-requirements §6 JSON.
4. Greenhouse `JobSource` (public API, no auth).
5. Normalize + dedupe + hard filters (pure, unit-tested).
6. Spike: confirm OpenClaw can run headlessly with a scoped tool allowlist against `ollama/llama3.1` and return valid structured JSON — de-risks the analysis-side unknown (§2) before the rest of the pipeline depends on it.
7. Wire the spike into the real `analyze_job` step; compute weighted score in our code.
8. `npm run agent:run` CLI producing the ranked-matches output format (source requirements' §33).
9. Verify: running the agent twice produces zero duplicate job rows.

**Checkpoint:** Phase A must be working end to end — real Greenhouse jobs, real analysis, real ranked CLI output, no duplicate rows on rerun — before Phase B starts. This is a hard gate, not a suggestion: it guarantees Milestone 1 has something working even if browser automation turns out harder than expected.

**Phase B — LinkedIn/Naukri browser-driven source:**

10. Spike: confirm OpenClaw's browser capability can drive the user's own logged-in Chrome session, run a scoped job search, and extract structured job data (title, company, URL, location, description) — light-touch only (§4/§9): no proxy rotation, no fingerprint spoofing, no CAPTCHA-solving, human-like pace and low frequency.
11. LinkedIn `JobSource` built on that spike.
12. Naukri `JobSource`, same pattern.
13. Both feed the same normalize → dedupe → hard-filter → analyze → score → persist path as Greenhouse — no source-specific branching downstream of normalization.
14. Verify: running the agent twice across all three sources produces zero duplicate rows, and the same job cross-posted on Greenhouse and LinkedIn is still caught by the multi-signal dedup (§8).

**Explicitly out of scope for Milestone 1**: Lever/Workable, scheduler/cron, dashboard (FE stays reserved, §10), applications-tracking UI (table exists, no UI).

## 14. Development Strategy

Implement in the order listed in §13, one item at a time. After each stage: run tests, inspect real output, fix errors, commit. Do not proceed to the next stage while the current one is broken. Do not implement past Milestone 1 without the user's explicit approval of the next milestone.
