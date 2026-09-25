import { dedupeKey, filterNewJobs } from "../../src/pipeline/dedupe";
import type { Job } from "../../src/types/job";

function makeJob(overrides: Partial<Job>): Job {
  return {
    id: "x",
    source: "greenhouse",
    sourceJobId: "1",
    company: "Acme",
    title: "Software Engineer",
    description: "desc",
    url: "https://example.com/1",
    locations: ["Remote"],
    discoveredAt: new Date(),
    status: "new",
    ...overrides,
  };
}

describe("dedupeKey", () => {
  it("prefers sourceJobId when present", () => {
    const job = makeJob({ source: "greenhouse", sourceJobId: "42" });
    expect(dedupeKey(job)).toBe("id:greenhouse:42");
  });

  it("falls back to URL when there is no sourceJobId", () => {
    const job = makeJob({ sourceJobId: undefined, url: "https://example.com/job/7" });
    expect(dedupeKey(job)).toBe("url:https://example.com/job/7");
  });

  it("falls back to company+title+location when there is no sourceJobId or URL", () => {
    const job = makeJob({
      sourceJobId: undefined,
      url: "",
      company: "Acme",
      title: "Software Engineer",
      locations: ["Pune"],
    });
    expect(dedupeKey(job)).toBe("sig:acme|software engineer|pune");
  });
});

describe("filterNewJobs", () => {
  it("removes jobs whose dedupe key already exists", () => {
    const existing = new Set([dedupeKey(makeJob({ sourceJobId: "1" }))]);
    const jobs = [makeJob({ sourceJobId: "1" }), makeJob({ sourceJobId: "2" })];

    const result = filterNewJobs(jobs, existing);

    expect(result).toHaveLength(1);
    expect(result[0].sourceJobId).toBe("2");
  });
});
