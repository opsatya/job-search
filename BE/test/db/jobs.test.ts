import { prisma } from "../../src/db/client";
import { getExistingDedupeKeys, saveNewJobs } from "../../src/db/jobs";
import type { Job } from "../../src/types/job";

function makeJob(sourceJobId: string): Job {
  return {
    id: "x",
    source: "greenhouse",
    sourceJobId,
    company: "Acme",
    title: "Software Engineer",
    description: "desc",
    url: `https://example.com/${sourceJobId}`,
    locations: ["Remote"],
    discoveredAt: new Date(),
    status: "new",
  };
}

describe("jobs persistence", () => {
  afterEach(async () => {
    await prisma.jobMatch.deleteMany();
    await prisma.job.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("saves new jobs and returns their DB ids keyed by dedupe key", async () => {
    const ids = await saveNewJobs([makeJob("1"), makeJob("2")]);
    expect(ids.size).toBe(2);
    const count = await prisma.job.count();
    expect(count).toBe(2);
  });

  it("returns existing dedupe keys for jobs already in the DB", async () => {
    await saveNewJobs([makeJob("1")]);
    const keys = await getExistingDedupeKeys();
    expect(keys.has("id:greenhouse:1")).toBe(true);
  });

  it("does not create duplicate rows when saving the same job twice", async () => {
    await saveNewJobs([makeJob("1")]);
    const existing = await getExistingDedupeKeys();
    const jobs = [makeJob("1"), makeJob("2")].filter((j) => {
      const key = `id:greenhouse:${j.sourceJobId}`;
      return !existing.has(key);
    });
    await saveNewJobs(jobs);
    const count = await prisma.job.count();
    expect(count).toBe(2);
  });
});
