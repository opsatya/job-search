import { prisma } from "../../src/db/client";
import { getExistingDedupeKeys, saveNewJobs, getJobsPendingAnalysis } from "../../src/db/jobs";
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

// Scoped to this file's own fixture dedupeKeys ("id:greenhouse:1"/"2") rather
// than wiping the whole table — these tests run against the same
// DATABASE_URL as real agent runs (no separate test DB), so an unscoped
// deleteMany() would silently destroy real, already-persisted job data. This
// was caught for real by Task 15's end-to-end verification: running `npm
// test` after populating the DB with a real pipeline run wiped every row.
const TEST_DEDUPE_KEYS = ["id:greenhouse:1", "id:greenhouse:2"];

async function cleanupTestFixtures(): Promise<void> {
  await prisma.jobMatch.deleteMany({ where: { job: { dedupeKey: { in: TEST_DEDUPE_KEYS } } } });
  await prisma.job.deleteMany({ where: { dedupeKey: { in: TEST_DEDUPE_KEYS } } });
}

describe("jobs persistence", () => {
  beforeEach(cleanupTestFixtures);
  afterEach(cleanupTestFixtures);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("saves new jobs and returns their DB ids keyed by dedupe key", async () => {
    const ids = await saveNewJobs([makeJob("1"), makeJob("2")]);
    expect(ids.size).toBe(2);
    const count = await prisma.job.count({ where: { dedupeKey: { in: TEST_DEDUPE_KEYS } } });
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
    const count = await prisma.job.count({ where: { dedupeKey: { in: TEST_DEDUPE_KEYS } } });
    expect(count).toBe(2);
  });

  it("returns jobs still awaiting analysis under the attempt limit, with their DB ids", async () => {
    const ids = await saveNewJobs([makeJob("1"), makeJob("2")]);
    const [id1, id2] = [ids.get("id:greenhouse:1")!, ids.get("id:greenhouse:2")!];
    await prisma.job.update({ where: { id: id2 }, data: { analysisAttempts: 3 } });

    // Scoped to this file's fixtures: the shared DB may hold real pending jobs.
    const pending = (await getJobsPendingAnalysis(3)).filter((p) => [id1, id2].includes(p.jobId));

    expect(pending).toHaveLength(1);
    expect(pending[0].jobId).toBe(id1);
    expect(pending[0].job.sourceJobId).toBe("1");
    expect(pending[0].job.title).toBe("Software Engineer");
  });

  it("does not return jobs that are already reviewed", async () => {
    const ids = await saveNewJobs([makeJob("1")]);
    const id1 = ids.get("id:greenhouse:1")!;
    await prisma.job.update({ where: { id: id1 }, data: { status: "reviewed" } });

    const pending = await getJobsPendingAnalysis(3);
    expect(pending.some((p) => p.jobId === id1)).toBe(false);
  });
});
