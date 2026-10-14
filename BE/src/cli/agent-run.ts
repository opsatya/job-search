import { seedCandidateProfile } from "../db/candidate-profile";
import { runPipeline } from "../pipeline/orchestrator";
import { failAgentRun } from "../db/agent-runs";
import type { PipelineResult } from "../pipeline/orchestrator";

export function formatResultsForDisplay(result: PipelineResult): string {
  const lines: string[] = [];
  lines.push("Starting Job Search Agent...");
  lines.push("");
  lines.push("Sources:");
  lines.push("✓ Greenhouse");
  lines.push("");
  lines.push(`Jobs found: ${result.jobsFound}`);
  lines.push(`New jobs: ${result.jobsNew}`);
  lines.push(`Filtered: ${result.jobsFiltered}`);
  lines.push(`Analyzed: ${result.jobsAnalyzed}`);
  lines.push(`Retried (earlier failed analyses): ${result.jobsRetried}`);
  lines.push(`Needs review (analysis failed): ${result.jobsNeedingReview}`);
  lines.push("");
  lines.push("Top matches:");
  lines.push("");

  for (const match of result.matches) {
    lines.push(
      `${match.priority} ${Math.round(match.overallScore)}% — ${match.title} — ${match.company} — ${match.remoteEligibility}`,
    );
  }

  return lines.join("\n");
}

// Ctrl+C / kill during a long local-LLM run must not leave the run row
// "in_progress" forever. Best-effort: the run may not have been created yet.
export async function markRunInterrupted(runId: string, signal: string): Promise<void> {
  await failAgentRun(runId, `interrupted by ${signal}`).catch(() => undefined);
}

async function main(): Promise<void> {
  await seedCandidateProfile();
  const runId = new Date().toISOString();
  for (const [signal, exitCode] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    process.once(signal, () => {
      void markRunInterrupted(runId, signal).finally(() => process.exit(exitCode));
    });
  }
  const result = await runPipeline(runId);
  console.log(formatResultsForDisplay(result));
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Agent run failed:", err);
    process.exitCode = 1;
  });
}
