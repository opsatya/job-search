import type { Job } from "../types/job";

export function dedupeKey(job: Job): string {
  if (job.sourceJobId) {
    return `id:${job.source}:${job.sourceJobId}`;
  }
  if (job.url) {
    return `url:${job.url}`;
  }
  const normalizedTitle = job.title.trim().toLowerCase();
  const location = (job.locations[0] ?? "").trim().toLowerCase();
  return `sig:${job.company.trim().toLowerCase()}|${normalizedTitle}|${location}`;
}

export function filterNewJobs(jobs: Job[], existingKeys: Set<string>): Job[] {
  return jobs.filter((job) => !existingKeys.has(dedupeKey(job)));
}
