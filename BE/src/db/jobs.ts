import { prisma } from "./client";
import { dedupeKey } from "../pipeline/dedupe";
import type { Job } from "../types/job";

export async function getExistingDedupeKeys(): Promise<Set<string>> {
  const rows = await prisma.job.findMany({ select: { dedupeKey: true } });
  return new Set(rows.map((r) => r.dedupeKey));
}

export async function saveNewJobs(jobs: Job[]): Promise<Map<string, string>> {
  const idsByDedupeKey = new Map<string, string>();

  for (const job of jobs) {
    const key = dedupeKey(job);
    const created = await prisma.job.create({
      data: {
        source: job.source,
        sourceJobId: job.sourceJobId,
        dedupeKey: key,
        company: job.company,
        title: job.title,
        description: job.description,
        url: job.url,
        companyUrl: job.companyUrl,
        locations: job.locations,
        remote: job.remote,
        employmentType: job.employmentType,
        experienceMin: job.experienceMin,
        experienceMax: job.experienceMax,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        technologies: job.technologies ?? [],
        postedAt: job.postedAt,
        status: job.status,
      },
    });
    idsByDedupeKey.set(key, created.id);
  }

  return idsByDedupeKey;
}
