import { seedCandidateProfile } from "../db/candidate-profile";
import { runPipeline } from "../pipeline/orchestrator";
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

async function main(): Promise<void> {
  await seedCandidateProfile();
  const runId = new Date().toISOString();
  const result = await runPipeline(runId);
  console.log(formatResultsForDisplay(result));
}

main().catch((err) => {
  console.error("Agent run failed:", err);
  process.exitCode = 1;
});
