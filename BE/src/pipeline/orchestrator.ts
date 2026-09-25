import { GreenhouseSource } from "../sources/greenhouse";
import { normalizeGreenhouseJob } from "../sources/greenhouse/normalize";
import { filterNewJobs, dedupeKey } from "./dedupe";
import { passesHardFilters } from "./filters";
import { analyzeJob } from "../agent/analyze-job";
import type { PriorityTier, JobAnalysisResult } from "./scoring";
import { getCandidateProfile } from "../db/candidate-profile";
import { getExistingDedupeKeys, saveNewJobs } from "../db/jobs";
import { saveJobMatch } from "../db/job-matches";
import { startAgentRun, completeAgentRun } from "../db/agent-runs";
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
  matches: RankedMatch[];
}

function formatSalary(job: Job): string {
  if (!job.salaryMin && !job.salaryMax) return "Not disclosed";
  return `${job.salaryMin ?? "?"}-${job.salaryMax ?? "?"} ${job.salaryCurrency ?? ""}`.trim();
}

function summarizeEligibility(analysis: JobAnalysisResult): string {
  const { indiaEligible, worldwideRemote } = analysis.eligibility;
  if (indiaEligible === true) return "India-eligible";
  if (worldwideRemote === true) return "Worldwide";
  if (indiaEligible === "UNKNOWN" && worldwideRemote === "UNKNOWN") return "Unknown";
  return "Restricted";
}

export async function runPipeline(runId: string): Promise<PipelineResult> {
  await startAgentRun(runId);

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

  const savedIds = await saveNewJobs(survivors);

  const matches: RankedMatch[] = [];
  for (const job of survivors) {
    const analysis = await analyzeJob(job);
    const jobId = savedIds.get(dedupeKey(job));
    if (!jobId) continue;

    const { overallScore, priority } = await saveJobMatch(jobId, job, candidate, analysis);

    matches.push({
      title: job.title,
      company: job.company,
      location: job.locations.join(", "),
      salary: formatSalary(job),
      remoteEligibility: summarizeEligibility(analysis),
      overallScore,
      priority,
    });
  }

  matches.sort((a, b) => b.overallScore - a.overallScore);

  const result: PipelineResult = {
    sourcesChecked: 1,
    jobsFound: rawJobs.length,
    jobsNew: newJobs.length,
    jobsFiltered,
    jobsAnalyzed: survivors.length,
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
