import type { JobSearchParams, JobSource, RawJob } from "../types";

interface GreenhouseApiJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  content: string;
  updated_at: string;
}

export class GreenhouseSource implements JobSource {
  name = "greenhouse";

  constructor(private readonly boardTokens: string[]) {}

  async search(_params: JobSearchParams): Promise<RawJob[]> {
    const results: RawJob[] = [];

    for (const token of this.boardTokens) {
      const response = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
      );

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as { jobs: GreenhouseApiJob[] };

      for (const job of data.jobs) {
        results.push({
          source: "greenhouse",
          sourceJobId: String(job.id),
          title: job.title,
          company: token,
          url: job.absolute_url,
          locationText: job.location.name,
          description: job.content,
          postedAt: job.updated_at,
        });
      }
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    if (this.boardTokens.length === 0) return false;
    const response = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${this.boardTokens[0]}/jobs`,
    );
    return response.ok;
  }
}
