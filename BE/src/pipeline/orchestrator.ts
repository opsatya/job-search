import { GreenhouseSource } from "../sources/greenhouse";
import { normalizeGreenhouseJob } from "../sources/greenhouse/normalize";
import { filterNewJobs, dedupeKey } from "./dedupe";
import { passesHardFilters } from "./filters";
import { analyzeJob } from "../agent/analyze-job";
import type { PriorityTier, JobFacts } from "./scoring";
import { getCandidateProfile } from "../db/candidate-profile";
import { getExistingDedupeKeys, saveNewJobs, getJobsPendingAnalysis } from "../db/jobs";
import { saveJobMatch } from "../db/job-matches";
import { startAgentRun, completeAgentRun, failAgentRun, failAbandonedRuns } from "../db/agent-runs";
import { SEARCH_CONFIG } from "../config/search-config";
import type { Job } from "../types/job";

export interface RankedMatch {
  title: string;
  company: string;
  location: string;
  salary: string;
  remoteEligibility: string;
  overallScore: number;
  priority: PriorityTier;
}

export interface PipelineResult {
  sourcesChecked: number;
  jobsFound: number;
  jobsNew: number;
  jobsFiltered: number;
  jobsAnalyzed: number;
  jobsNeedingReview: number;
  jobsRetried: number;
  matches: RankedMatch[];
}

function formatSalary(job: Job): string {
  if (!job.salaryMin && !job.salaryMax) return "Not disclosed";
  return `${job.salaryMin ?? "?"}-${job.salaryMax ?? "?"} ${job.salaryCurrency ?? ""}`.trim();
}

function summarizeEligibility(facts: JobFacts): string {
  const { indiaEligible, worldwideRemote } = facts.eligibility;
  if (indiaEligible === true) return "India-eligible";
  if (worldwideRemote === true) return "Worldwide";
  if (indiaEligible === "UNKNOWN" && worldwideRemote === "UNKNOWN") return "Unknown";
  return "Restricted";
}

export async function runPipeline(runId: string): Promise<PipelineResult> {
  await startAgentRun(runId);
  try {
    const abandoned = await failAbandonedRuns(runId);
    if (abandoned > 0) console.warn(`runPipeline: marked ${abandoned} abandoned run(s) as failed`);
    return await executeRun(runId);
  } catch (err) {
    // Close the run as failed rather than leaving it "in_progress" forever;
    // never let a secondary DB error here mask the original failure.
    await failAgentRun(runId, (err as Error).message).catch((failErr) =>
      console.error(`runPipeline: could not mark run ${runId} failed:`, failErr),
    );
    throw err;
  }
}

// After this many failed analyses a job stops being retried and stays
// visible as "needs review" for a human to look at.
export const MAX_ANALYSIS_ATTEMPTS = 3;

async function executeRun(runId: string): Promise<PipelineResult> {
  const candidate = await getCandidateProfile();

  const source = new GreenhouseSource([...SEARCH_CONFIG.greenhouseBoardTokens]);
  const rawJobs = await source.search({
    roles: [...SEARCH_CONFIG.roles],
    locations: [...SEARCH_CONFIG.locations],
  });

  const normalized = rawJobs.map(normalizeGreenhouseJob);

  const existingKeys = await getExistingDedupeKeys();
  const newJobs = filterNewJobs(normalized, existingKeys);

  const survivors = newJobs.filter(passesHardFilters);
  const jobsFiltered = newJobs.length - survivors.length;

  // Persist every newly-discovered job — not just the ones that survive hard
  // filters — so their dedupeKey is recorded. Otherwise a job that fails hard
  // filters today is never saved, `getExistingDedupeKeys()` never learns about
  // it, and it gets rediscovered as "new" (and re-filtered) on every future
  // run forever. Filtered-out jobs are saved with status "rejected" so they
  // stay distinguishable from jobs still awaiting review.
  const survivorKeys = new Set(survivors.map(dedupeKey));
  const jobsToPersist = newJobs.map((job) =>
    survivorKeys.has(dedupeKey(job)) ? job : { ...job, status: "rejected" as const },
  );

  const savedIds = await saveNewJobs(jobsToPersist);

  const toAnalyze: { jobId: string; job: Job }[] = [];
  for (const job of survivors) {
    const jobId = savedIds.get(dedupeKey(job));
    if (jobId) toAnalyze.push({ jobId, job });
  }
  // Earlier runs' jobs still awaiting a successful analysis (failed attempts,
  // or a crashed/interrupted run that never reached them).
  const justSaved = new Set(toAnalyze.map((entry) => entry.jobId));
  const retries = (await getJobsPendingAnalysis(MAX_ANALYSIS_ATTEMPTS)).filter(
    (pending) => !justSaved.has(pending.jobId),
  );
  toAnalyze.push(...retries);

  const matches: RankedMatch[] = [];
  let jobsNeedingReview = 0;
  for (const { jobId, job } of toAnalyze) {
    try {
      const facts = await analyzeJob(job);
      const { overallScore, priority } = await saveJobMatch(jobId, job, candidate, facts);
      if (overallScore === null || priority === null) {
        jobsNeedingReview++;
        continue;
      }

      matches.push({
        title: job.title,
        company: job.company,
        location: job.locations.join(", "),
        salary: formatSalary(job),
        remoteEligibility: summarizeEligibility(facts),
        overallScore,
        priority,
      });
    } catch (err) {
      // One job failing to analyze or persist (e.g. a transient DB error inside
      // saveJobMatch's transaction) must not take down the whole run — log and
      // move on, same "one failure doesn't kill the run" principle already
      // applied to per-source fetch failures and analysis failures.
      console.error(`runPipeline: failed to process job ${jobId} (${job.title}):`, err);
      continue;
    }
  }

  matches.sort((a, b) => b.overallScore - a.overallScore);

  const result: PipelineResult = {
    sourcesChecked: 1,
    jobsFound: rawJobs.length,
    jobsNew: newJobs.length,
    jobsFiltered,
    jobsAnalyzed: toAnalyze.length,
    jobsNeedingReview,
    jobsRetried: retries.length,
    matches,
  };

  await completeAgentRun(runId, {
    sourcesChecked: result.sourcesChecked,
    jobsFound: result.jobsFound,
    jobsNew: result.jobsNew,
    jobsFiltered: result.jobsFiltered,
    jobsAnalyzed: result.jobsAnalyzed,
    strongMatches: matches.filter((m) => m.priority === "P0" || m.priority === "P1").length,
  });

  return result;
}
