# Job Search Agent — Phase 0 Design

Status: approved for spec, plan being regenerated for the updated scope below
Branch: `feature/agent`
Source requirements: `Requirements/requirements.md` (supersedes the original root-level requirements doc, which was deleted on 2026-09-25). Anything in this spec not explicitly changed here still reflects that original doc's Phase 0 framing (hybrid deterministic+LLM architecture, human-in-the-loop, no auto-apply).

**2026-09-25 revision note:** `Requirements/requirements.md` replaced the original requirements doc with a substantially larger scope — Excel export, contact discovery, company tracking, a 3-bucket search strategy, and an eligibility/evidence system. This revision folds in the changes that reshape the *existing* Phase A pipeline (candidate facts, scoring formula, eligibility fields) and explicitly defers the new independent subsystems to later phases (§10). At the time of this revision, Task 1 (BE scaffold) was complete and Task 2 (Prisma schema) was blocked on Postgres credentials — neither is invalidated by this update.

## 1. Purpose

A personal AI-powered job discovery and matching agent for Satyajeet Singh. This phase proves one loop works end to end:

```
User Profile → Job Search → Collection → Normalization → Eligibility Extraction
→ Deduplication → Hard Filtering → LLM Analysis → Deterministic Score → Ranked Results → User
```

It is explicitly not an application bot. The agent finds, analyzes, and ranks jobs; the user decides what to apply to. No automatic applications, no recruiter outreach, no LinkedIn login automation, no anti-bot bypass — these remain out of scope for this phase (see §9).

The guiding product rule from `Requirements/requirements.md` carries forward unchanged: optimize for RELEVANCE × ELIGIBILITY × RECENCY × APPLICATION QUALITY, not raw job count. A good Phase A run is "20 jobs found, 5 excellent matches," not "500 jobs, 500 irrelevant results."

## 2. Architecture

```
CLI (agent:run)
   │
   ▼
Pipeline (TypeScript — deterministic, fixed step order)
   │
   ├─ Load candidate profile (from profile/candidate.yaml, seeded to Postgres)
   ├─ Load search configuration (Postgres/JSON)
   ├─ JobSource.search() — Greenhouse (Phase A), then LinkedIn/Naukri (Phase B, §14)
   ├─ Normalize → canonical Job
   ├─ Deduplicate (sourceJobId / canonical URL / company+title+location)
   ├─ Hard filters (seniority exclusions, role-keyword inclusion)
   ├─ For each surviving job → OpenClaw agent call (analysis step only)
   │       tool allowlist: get_candidate_profile, analyze_job
   │       model: ollama/llama3.1
   │       returns: structured JSON — extracted facts (§8) + qualitative reasoning (§8) —
   │                never a numeric score
   ├─ Deterministic category scores + overall score (§8 formula, computed in our code — never by the LLM)
   └─ Persist (jobs, job_matches, agent_runs) via Prisma
   │
   ▼
CLI output: ranked matches
```

### Why the LLM/agent boundary is drawn where it is

`Requirements/requirements.md` restates the same hybrid-architecture rule the original requirements gave: "Use deterministic scoring in TypeScript. LLM analysis may provide structured reasoning but must not replace deterministic scoring" and "Do NOT produce an unexplained AI score." This spec already drew that boundary in the original design (LLM never computes the final score); this revision tightens it further — the LLM no longer produces *any* of the seven category subscores either (§8). Its job narrows to two things: extracting structured, evidence-backed facts from the free-text job posting (skills mentioned, experience requirement, eligibility signals, salary if stated), and producing qualitative narrative reasoning (why it matches, gaps, concerns). All seven category scores are computed by pure TypeScript functions from those extracted facts and the candidate profile — the LLM never sees or influences the point values directly.

This design resolves the same OpenClaw-scope question as before: our TypeScript code drives the fixed pipeline end to end (search → normalize → dedupe → filter → extract+reason → score → persist), and OpenClaw's tool-calling agent is invoked narrowly, once per job that survives filtering, to produce the structured extraction+reasoning JSON. This keeps the pipeline deterministic, testable, and debuggable, while still giving OpenClaw the one job that genuinely needs LLM judgment: reading unstructured text.

OpenClaw is used a second, separate way in this phase: as the browser-driving mechanism for the LinkedIn/Naukri source (§4). That usage has nothing to do with LLM reasoning — it's OpenClaw's browser capability navigating a real Chrome session to run a search and extract structured data, more analogous to Greenhouse's API call than to the analysis step. It gets its own narrow tool/capability scope (browser navigation + extraction only) independent of the analysis session's allowlist.

### OpenClaw — verified facts (2026-08-26)

OpenClaw (`github.com/openclaw/openclaw`, npm package `openclaw`, actively released — latest `2026.7.1-2` at time of writing) is a real, actively maintained personal-AI-assistant project with a Gateway control plane, channel integrations (WhatsApp/Telegram/Slack/Discord/etc.), a TypeScript plugin/tool SDK, and a plugin marketplace (ClawHub). Confirmed relevant to this project:

- **Ollama support**: native, auto-detected at `127.0.0.1:11434`. Models referenced as `ollama/<model>`, e.g. `ollama/llama3.1`.
- **Custom tools**: registerable via its plugin/tool SDK.
- **Cron**: listed as a first-class capability, usable for the later scheduled-run milestone.
- **Sandboxing**: documented; tools run on-host by default unless sandboxing is configured.

Not yet verified: whether OpenClaw can be invoked headlessly for a single scoped task (no channel, no persistent session) and cleanly exit with structured output, versus requiring its full Gateway/session model to be running. This is the one real architectural unknown on the analysis side and is deliberately sequenced as an early Phase A task in Milestone 1 (§14) — a cheap spike before the rest of the pipeline is built assuming a particular integration shape. If headless invocation proves awkward, the fallback is calling Ollama directly through the `LLMProvider` interface (§6) for this phase, and revisiting OpenClaw integration once its non-interactive story is clearer.

## 3. Candidate Profile

**Changed in this revision.** Facts updated per `Requirements/requirements.md`:

- Education: MCA, Savitribai Phule Pune University — **completed**, CGPA ~7.91/10 (previously stated as in-progress, 2024–2026).
- Experience: **~10 months** production experience as a Full-Stack Developer in a production SaaS environment, across frontend, backend, databases, cloud, APIs, authentication, debugging, and deployment (previously open-ended "2025–Present").
- Positioning unchanged: an early-career software engineer with real production experience — not a "fresher with no experience," and not exaggerated as senior.
- Primary stack: TypeScript, JavaScript, React, Node.js, Fastify, PostgreSQL, Prisma, Redis, REST APIs, AWS. Secondary: MongoDB, Docker, Linux, Nginx, React Native, Python, Java, Git/GitHub, BullMQ, Socket.IO, Redux Toolkit, Tailwind CSS, CI/CD, Monorepos.
- Target roles, locations, and compensation preferences: as listed in `Requirements/requirements.md`'s Candidate Profile section (target experience 0–2 years; compensation preferred ₹6–8 LPA+, floor not a hard filter — see §8).

**Source-of-truth mechanism changed.** `Requirements/requirements.md` proposes an editable `profile/candidate.md` + `preferences.yaml` file pair rather than a hardcoded TypeScript constant. This spec adopts a simplified single-file version of that idea: `BE/profile/candidate.yaml`, human-editable, version-controlled. A loader parses it (using `js-yaml`, added to the Tech Stack) and seeds/updates the `candidate_profile` table from it on every `agent:run` — the DB row stays the queryable/auditable copy, the YAML file stays the thing a human actually edits. This satisfies the original "profile must eventually be editable" requirement without needing an edit UI. No `resume.pdf` parsing this phase — not requested by any concrete feature yet (YAGNI).

## 4. Job Sources

Unchanged from the original design for Phase A/B scope. `Requirements/requirements.md` lists a much larger source list (Wellfound, other ATS platforms, general remote boards, company LinkedIn pages) — these are **deferred** (§10), not added to Milestone 1. Tier 1 stays Greenhouse-first for Phase A, LinkedIn/Naukri light-touch browsing for Phase B, exactly as before.

### Tier 1 (Milestone 1 and near-term follow-up) — public APIs, no auth, no ToS conflict

- **Greenhouse** (`boards-api.greenhouse.io`) — Milestone 1's only source. Public, unauthenticated JSON API designed for embedding job boards.
- **Lever** (`api.lever.co`) — same category, added once Greenhouse proves the pattern.
- **Workable**, **company career pages** — tier 2, added opportunistically.

### LinkedIn / Naukri — in scope for Milestone 1, sequenced after Greenhouse, explicitly risk-flagged

`Requirements/requirements.md` restates the same constraint the original doc gave, just reworded: "Do not depend on LinkedIn scraping... Do not bypass authentication, CAPTCHAs, anti-bot systems, paywalls, or access controls," and separately, "LinkedIn should not be the foundation. It can be a discovery source if your tooling can access it legitimately, but don't build a system dependent on scraping logged-in LinkedIn pages." This is consistent with — not a change to — the resolution already agreed:

This is built as light-touch personal browsing through the user's own logged-in Chrome session, at low frequency, behaving like a human clicking through search results — no proxy rotation, no browser-fingerprint spoofing, no CAPTCHA-solving, no scraping-detection evasion of any kind. It is a **separate `JobSource` implementation**, driven by OpenClaw's browser capability rather than an HTTP client, and — critically, matching the new wording — the pipeline must not *depend* on it: Phase A's Greenhouse path is a fully working system on its own, and LinkedIn/Naukri is additive, sequenced strictly after Phase A is verified working end to end (§14). This remains a real account/ToS risk even in its light-touch form; it is the user's own account and own risk tolerance, not mass scraping of third parties.

### Source abstraction

```typescript
interface JobSource {
  name: string;
  search(params: JobSearchParams): Promise<RawJob[]>;
  fetchJob?(url: string): Promise<RawJob>;
  healthCheck?(): Promise<boolean>;
}
```

Every source returns data normalized into the same canonical `Job` shape (§5). Nothing downstream of normalization is coupled to any one source.

## 5. Normalized Job Object and Eligibility/Evidence Fields

Base fields unchanged from the original design: `id`, `source`, `sourceJobId`, `company`, `title`, `description`, `url`, `locations`, `remote`, `employmentType`, `experienceMin/Max`, `salaryMin/Max/Currency`, `technologies`, `postedAt`, `discoveredAt`, `status`, `matchScore`.

**New in this revision**, per `Requirements/requirements.md`'s Remote Eligibility section — these live on the `JobMatch` record (§7), populated by the extraction step (§8), not on `Job` itself, since they're derived analysis rather than raw source data:

```typescript
interface EligibilityFacts {
  remoteStatus: "remote" | "hybrid" | "onsite" | "unclear";
  indiaEligible: boolean | "UNKNOWN";
  worldwideRemote: boolean | "UNKNOWN";
  locationRestriction?: string;       // e.g. "UK only", "Americas only"
  visaRequired: boolean | "UNKNOWN";
  relocationRequired: boolean | "UNKNOWN";
  eligibilityConfidence: "high" | "medium" | "low";
  eligibilityEvidence: string;        // quoted/paraphrased evidence from the posting, or "not stated in posting"
  salaryEvidence?: string;            // same idea, for the salary figure if present
}
```

**The rule that matters most:** never infer `UNKNOWN` into `true`. A job that says "Remote" with no further qualifier gets `indiaEligible: "UNKNOWN"`, not `true` — a job explicitly marked "Remote — India" or "Remote — Worldwide" gets `true` with the quoted evidence. This is enforced at the prompt level (§8's extraction instructions) and is exactly the kind of factual claim §9's evidence rule governs.

## 6. LLM Provider Abstraction

```typescript
interface LLMProvider {
  generateStructured<T>(prompt: string, schema: unknown): Promise<T>;
}
```

`OllamaProvider` is the initial implementation, configured via `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL=llama3.1` (confirmed installed locally). Not hard-coded — replaceable later with OpenAI/Gemini/Anthropic/OpenRouter/another local model. This interface exists independently of the OpenClaw integration so the LLM call can be made directly if the OpenClaw headless spike (§14) doesn't pan out.

## 7. Database

PostgreSQL (already available locally) + Prisma. Initial tables: `candidate_profile`, `jobs`, `job_matches`, `agent_runs`, `applications`. `job_matches` gains the `EligibilityFacts` fields (§5) and the seven category-score columns (§8) in place of the old single set of percentage-match columns. No vector database, no RAG infrastructure this phase.

## 8. Job Analysis: Extraction, Deterministic Scoring, and Qualitative Reasoning

**This section replaces the original design's single LLM-scoring step.** One OpenClaw call per surviving job still happens, but its output schema is richer and none of it is a point value:

```typescript
interface JobAnalysisResult {
  // Extracted facts — used by deterministic scoring, never scored by the LLM itself
  requiredSkills: string[];
  preferredSkills: string[];
  experienceRequirementYears: { min?: number; max?: number };
  seniorityLevel: "junior" | "mid" | "senior" | "unclear";
  educationRequirement?: string;
  domain?: string;                 // e.g. "SaaS", "FinTech", "DevTools", "AI", "E-commerce"
  eligibility: EligibilityFacts;   // §5

  // Qualitative reasoning — surfaced to the user, never fed into the score formula
  whyMatches: string;
  strongestMatchingSkills: string[];
  missingSkills: string[];
  experienceGap?: string;
  concerns: string[];
  applicationRecommendation: "strong_apply" | "apply" | "consider" | "needs_review" | "skip";
  interviewTopicsToPrepare: string[];
  factLabels: Record<string, "FACT" | "INFERENCE" | "UNKNOWN">; // per-claim labeling for eligibility, salary, and skill-match claims
}
```

### Deterministic category scoring (all pure TypeScript, unit-tested, zero LLM involvement)

Replaces the original 7-factor percentage-weighted formula with the point-based breakdown `Requirements/requirements.md` specifies directly:

```
Skill Match:             /30   — overlap between candidate skills and requiredSkills/preferredSkills
Experience Match:        /20   — candidate months-of-experience vs experienceRequirementYears
Location Eligibility:    /20   — indiaEligible/worldwideRemote/location tier vs candidate preferences
Seniority Match:         /15   — seniorityLevel vs candidate's early-career positioning
Education Match:          /5   — educationRequirement vs candidate's completed MCA
Salary/Compensation:      /5   — salary range vs candidate floor/target/preferred (§ below)
Domain Match:              /5  — domain vs candidate's positive-signal domains (SaaS/AI/DevTools/FinTech/HealthTech/etc.)
                          -----
overallScore =            /100 (sum of the seven — no further weighting; each is already scaled to its max)
```

Each function takes `(candidateProfile, extractedFacts)` and returns a number in its stated range — the implementation plan (not this spec) pins down the exact per-category formulas. Two rules bind every one of them:

- **`UNKNOWN` eligibility gets partial credit, never zero and never full.** A location-eligibility score of 0 would mean "definitely can't work this job," which isn't true for `UNKNOWN` — it means "the posting didn't say." The plan's Location Eligibility function must express this as a distinct, documented partial-credit band, not silently collapse `UNKNOWN` into either extreme.
- **Undisclosed salary is not penalized.** Per `Requirements/requirements.md`: "salary undisclosed — excellent match... You should also see it." A missing `salaryMin/Max` gets a neutral default (not 0) so a below-floor-but-undisclosed job isn't buried purely for lacking a number. Salary is a ranking factor, never a discovery filter — this was already true in the original design and stays true here.

### Priority tiers

`Requirements/requirements.md` defines four priority tiers without exact cutoffs (P0 exceptional, P1 strong, P2 reasonable, P3 stretch/needs verification). This spec fills that gap with a concrete mapping against the new 0–100 scale — flagged here as a judgment call, not something the requirements doc stated explicitly:

```
90–100 → P0 (exceptional)
80–89  → P1 (strong)
65–79  → P2 (reasonable)
<65    → P3 (stretch / needs verification)
```

Daily results surface P0/P1 primarily, optionally interesting P2s — same "don't flood with low-quality matches" principle as the original design's Excellent/Strong categories.

### Deterministic filtering (pre-LLM, unchanged)

Reject senior/staff/principal/lead/manager/director/architect/10+ years unless explicitly allowed; reject clearly unrelated roles (data scientist/analyst, QA-only, DevOps-only, PM, design, sales); keep junior/entry/graduate/associate/full-stack/backend/frontend/Node.js/React/TypeScript-flavored titles. `Requirements/requirements.md`'s hard filters add one refinement worth carrying into the filter logic: don't reject a job merely because *one* technology is missing if the core stack is strongly aligned (e.g. TypeScript+React+Node+PostgreSQL+AWS+one-unfamiliar-framework should still pass) — this is a filtering nuance, implemented in the same pure `passesHardFilters` function, not a reason to add an LLM call before filtering.

### Deduplication (unchanged)

Multi-signal — `sourceJobId`, canonical URL, company, normalized title, location. Running `agent:run` twice must not create duplicate rows. (`Requirements/requirements.md`'s dedup section — normalized company/role, canonical URL, ATS job ID, title+company similarity — describes the same mechanism; no change needed.)

### Anti-hallucination rule (extended)

The LLM must never infer a skill from a related one (e.g., REST ≠ GraphQL, AWS ≠ Kubernetes/Terraform/EKS) — unchanged. **Extended per this revision:** every extracted fact the LLM cannot directly support with text from the posting must be labeled `UNKNOWN`, not guessed, and every `FACT`/`INFERENCE`/`UNKNOWN` label must be recorded in `factLabels`. This is the same discipline the eligibility rule enforces (§5), generalized to the whole extraction schema.

## 9. Security Boundaries

Job descriptions are untrusted external content. They are passed into the OpenClaw analysis call strictly as tool-call *data*, never concatenated into anything resembling an instruction. The OpenClaw session for this step has a tool allowlist of exactly two read-oriented tools (`get_candidate_profile`, `analyze_job`) — it cannot reach `save_job` or any write-capable tool, so no adversarial job description can trigger an unintended write. No shell execution, no filesystem access, no env/secrets access, no arbitrary tool calls are exposed to the agent. Postgres credentials via env, never committed.

**Evidence-based claims rule (elevated from §8 to a standing project rule):** the system must never assert a factual field it cannot support with evidence from the source — this governs eligibility (§5), salary, and, in later phases, contact information (§10). A missing fact is `UNKNOWN` or `null`, never fabricated. This was implicit in the original anti-hallucination rule; `Requirements/requirements.md` makes it explicit enough ("NEVER guess email addresses," "not an AI-generated guess") that it belongs here as a named boundary, even though contact discovery itself is deferred.

Explicitly not built this phase: automatic applications, LinkedIn/Naukri automation beyond the light-touch personal-browsing carve-out in §4, CAPTCHA bypass, anti-bot bypass, recruiter messaging, multi-agent swarms, vector DB/RAG, Kubernetes, mobile app, complex memory/planning frameworks.

## 10. Deferred to Later Phases

`Requirements/requirements.md` describes several genuinely independent subsystems beyond the core discovery/matching loop. Per the decomposition principle (don't bloat one phase with unrelated subsystems), these are acknowledged here but explicitly **out of scope for the plan this spec drives** — each gets its own spec/plan cycle later, informed by what Phase A/B actually produce:

- **Excel export** (`Satyajeet_Job_Search_<DATE>.xlsx`, 8 sheets: Top Matches, All Jobs, Companies, Contacts, Application Tracker, Rejected Jobs, Search Sources, Search Summary). Needs real `job_matches` data to design against sensibly — building it before the pipeline produces real rows would mean guessing at the shape.
- **Contact discovery** (recruiter/hiring manager/founder lookup, evidence-only, never-guess-emails). A standalone research capability, not a pipeline stage.
- **Company discovery/tracking** ("Target Companies" list — companies worth watching even with no current opening). A different data model (companies, not jobs) with its own lifecycle.
- **`verification_status` lifecycle** (VERIFIED/PARTIALLY_VERIFIED/UNKNOWN/EXPIRED, checking whether an application page is still live). A freshness/quality layer on top of jobs already being discovered correctly — matters more once there's real volume to keep fresh.
- **3-bucket search strategy** (Bucket A: India; Bucket B: international companies explicitly hiring from India; Bucket C: high-upside startups) and the 14 search categories (A–N) `Requirements/requirements.md` lists. Phase A's single Greenhouse source with one board-token list doesn't need bucketing yet; this becomes relevant once multiple sources and a real search-volume target (100–200 raw → 30–50 shortlist) are in play.
- **Additional sources**: Wellfound, other public ATS platforms, general remote-job boards, company LinkedIn/job pages beyond the light-touch carve-out (§4).

None of this changes Phase A/B's design — it changes what happens after Milestone 1 ships and is verified.

## 11. Repository Structure

Two sibling packages, not a formal Turborepo/pnpm-workspace monorepo (no shared build tooling needed yet — that would be premature structure for two independently-runnable things):

```
BE/                backend: pipeline, sources, agent, db — all of Milestone 1's work
  profile/
    candidate.yaml   human-editable candidate profile (§3), source of truth
  src/
    cli/           agent:run entrypoint
    pipeline/      orchestrator, hard-filter rules, dedup, deterministic scoring (§8)
    sources/       JobSource interface + greenhouse/, linkedin/, naukri/
    agent/         OpenClaw integration: extraction+reasoning tool + browser-driven search
    llm/           LLMProvider interface + OllamaProvider
    db/            Prisma schema + client
    config/        candidate profile loader (reads profile/candidate.yaml), search config
  prisma/
    schema.prisma

FE/                dashboard — already scaffolded (Vite + React 19 + TypeScript + oxlint)
  src/             untouched until a future dashboard milestone; reserved, not built against yet
```

`FE/` was scaffolded by the user ahead of this plan and is left as-is for now — it becomes live in a future dashboard milestone, once there's pipeline data worth displaying. `BE/` stack: Node.js LTS, TypeScript, Prisma, Zod, `js-yaml` (candidate profile parsing), Jest (org standard), ESLint + Prettier. No Fastify yet — Milestone 1 is CLI-only, no HTTP server needed until BE needs to serve the dashboard.

## 12. Testing Strategy

Dedup logic, hard filters, and every category-scoring function (§8) are pure functions, fully unit-tested without DB/network dependencies — this matters more now than in the original design, since there are seven scoring functions instead of one weighted formula, each with its own edge cases (`UNKNOWN` eligibility, undisclosed salary). `JobSource` and the OpenClaw agent call are mocked in pipeline tests. A small set of integration tests run against a real (test) Postgres via Prisma. Running the agent twice in an integration test must assert zero duplicate job rows.

## 13. Error Handling

Each pipeline stage is a typed async function; stages don't reach into each other's internals. Per-source fetch failures are caught individually — one source failing doesn't kill the run — and reflected in `agent_runs`. OpenClaw analysis failures (malformed JSON, timeout) fall back to `applicationRecommendation: "needs_review"` with all eligibility fields `"UNKNOWN"` rather than crashing the run or dropping the job; the job is still saved with `status: "new"` and null score fields so nothing is silently lost.

## 14. Milestone 1 Scope

**Phase A — Greenhouse path (build and verify first):**

1. Repo scaffold (`BE/`: TypeScript, ESLint/Prettier, Jest) on `feature/agent`. **Done** (2026-08-26).
2. Prisma schema + migration (5 tables from §7, including the extended `job_matches` columns) against the existing local Postgres. **Blocked** on Postgres credentials as of this revision.
3. Candidate profile: `profile/candidate.yaml` (§3) + loader/seed function.
4. Greenhouse `JobSource` (public API, no auth).
5. Normalize + dedupe + hard filters (pure, unit-tested).
6. Spike: confirm OpenClaw can run headlessly with a scoped tool allowlist against `ollama/llama3.1` and return valid structured JSON matching `JobAnalysisResult` (§8) — de-risks the analysis-side unknown (§2) before the rest of the pipeline depends on it.
7. Wire the spike into the real extraction+reasoning call; implement the seven deterministic category-scoring functions (§8) in our code.
8. `npm run agent:run` CLI producing ranked-matches output (company, role, location, remote eligibility, salary, P0–P3 priority, overall score).
9. Verify: running the agent twice produces zero duplicate job rows.

**Checkpoint:** Phase A must be working end to end — real Greenhouse jobs, real analysis, real ranked CLI output, no duplicate rows on rerun — before Phase B starts. This is a hard gate, not a suggestion: it guarantees Milestone 1 has something working even if browser automation turns out harder than expected.

**Phase B — LinkedIn/Naukri browser-driven source:**

10. Spike: confirm OpenClaw's browser capability can drive the user's own logged-in Chrome session, run a scoped job search, and extract structured job data (title, company, URL, location, description) — light-touch only (§4/§9): no proxy rotation, no fingerprint spoofing, no CAPTCHA-solving, human-like pace and low frequency.
11. LinkedIn `JobSource` built on that spike.
12. Naukri `JobSource`, same pattern.
13. Both feed the same normalize → dedupe → hard-filter → extract+reason → score → persist path as Greenhouse — no source-specific branching downstream of normalization.
14. Verify: running the agent twice across all three sources produces zero duplicate rows, and the same job cross-posted on Greenhouse and LinkedIn is still caught by the multi-signal dedup (§8).

**Explicitly out of scope for Milestone 1**: everything in §10, plus Lever/Workable, scheduler/cron, dashboard (FE stays reserved, §11), applications-tracking UI (table exists, no UI).

## 15. Development Strategy

Implement in the order listed in §14, one item at a time. After each stage: run tests, inspect real output, fix errors, commit. Do not proceed to the next stage while the current one is broken. Do not implement past Milestone 1 without the user's explicit approval of the next milestone.
