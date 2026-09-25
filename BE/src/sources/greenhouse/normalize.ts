import type { RawJob } from "../types";
import type { Job } from "../../types/job";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function normalizeGreenhouseJob(raw: RawJob): Job {
  const isRemote = /remote/i.test(raw.locationText);

  return {
    id: `greenhouse:${raw.sourceJobId}`,
    source: raw.source,
    sourceJobId: raw.sourceJobId,
    company: raw.company,
    title: raw.title,
    description: stripHtml(raw.description),
    url: raw.url,
    locations: [raw.locationText],
    remote: isRemote,
    discoveredAt: new Date(),
    postedAt: raw.postedAt ? new Date(raw.postedAt) : undefined,
    status: "new",
  };
}
