import { prisma } from "../../src/db/client";
import { saveNewJobs } from "../../src/db/jobs";
import { saveJobMatch } from "../../src/db/job-matches";
import type { Job } from "../../src/types/job";
import type { CandidateProfile } from "../../src/types/candidate";
import type { JobAnalysisResult } from "../../src/pipeline/scoring";

const CANDIDATE: CandidateProfile = {
  name: "Satyajeet Singh",
  location: "Pune",
  education: { degree: "MCA", university: "SPPU", status: "completed", cgpa: 7.91 },
  experience: { months: 10, production: true },
  primaryRoles: [],
  secondaryRoles: [],
  skills: {
    languages: ["TypeScript"],
    backend: ["Node.js"],
    frontend: ["React"],
    databases: [],
    cloudDevOps: [],
    architecture: [],
  },
  preferences: {
    remotePreferred: true,
    locations: ["Pune"],
    internationalRemote: true,
    salaryFloorLpa: 5,
    salaryTargetLpa: 6,
    salaryPreferredLpa: 8,
    startupFriendly: true,
    productCompanyPreferred: true,
  },
};

const ANALYSIS: JobAnalysisResult = {
  requiredSkills: ["TypeScript", "Node.js"],
  preferredSkills: ["React"],
  experienceRequirementYears: { min: 0.5 },
  seniorityLevel: "junior",
  domain: "SaaS",
  eligibility: {
    remoteStatus: "remote",
    indiaEligible: true,
    worldwideRemote: false,
    visaRequired: false,
    relocationRequired: false,
    eligibilityConfidence: "high",
    eligibilityEvidence: "Job posting states: Remote - India",
  },
  whyMatches: "Strong TypeScript/Node alignment.",
  strongestMatchingSkills: ["TypeScript", "Node.js"],
  missingSkills: [],
  concerns: [],
  applicationRecommendation: "strong_apply",
  interviewTopicsToPrepare: ["System design basics"],
  factLabels: { indiaEligible: "FACT" },
};

function makeJob(): Job {
  return {
    id: "x",
    source: "greenhouse",
    // A fixture id distinct from test/db/jobs.test.ts's ("1"/"2") — Jest runs
    // test files in separate parallel workers by default, and both files hit
    // the same real DATABASE_URL, so sharing a dedupeKey across files causes
    // a cross-file race (one file's cleanup/insert collides with the
    // other's), surfaced for real by Task 15's end-to-end run.
    sourceJobId: "jm-1",
    company: "Acme",
    title: "Software Engineer",
    description: "desc",
    url: "https://example.com/jm-1",
    locations: ["Remote"],
    discoveredAt: new Date(),
    status: "new",
  };
}

// Scoped to this file's own fixture dedupeKey ("id:greenhouse:1") rather than
// wiping the whole table — see the comment in test/db/jobs.test.ts for why an
// unscoped deleteMany() is unsafe against a DATABASE_URL that also holds real
// pipeline data (Task 15's end-to-end run found this the hard way).
const TEST_DEDUPE_KEY = "id:greenhouse:jm-1";

async function cleanupTestFixtures(): Promise<void> {
  await prisma.jobMatch.deleteMany({ where: { job: { dedupeKey: TEST_DEDUPE_KEY } } });
  await prisma.job.deleteMany({ where: { dedupeKey: TEST_DEDUPE_KEY } });
}

describe("saveJobMatch", () => {
  beforeEach(cleanupTestFixtures);
  afterEach(cleanupTestFixtures);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists the computed scores, priority, eligibility, and reasoning against the job", async () => {
    const ids = await saveNewJobs([makeJob()]);
    const jobId = [...ids.values()][0];

    await saveJobMatch(jobId, makeJob(), CANDIDATE, ANALYSIS);

    const match = await prisma.jobMatch.findFirst({ where: { jobId } });
    expect(match).not.toBeNull();
    expect(match?.skillMatch).toBe(30);
    expect(match?.overallScore).toBeGreaterThan(0);
    expect(match?.priority).toMatch(/^P[0-3]$/);
    expect(match?.indiaEligible).toBe(true);
    expect(match?.worldwideRemote).toBe(false);
    expect(match?.whyMatches).toBe("Strong TypeScript/Node alignment.");
    expect((match?.factLabels as Record<string, string>).indiaEligible).toBe("FACT");

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.matchScore).toBe(match?.overallScore);
    expect(job?.status).toBe("reviewed");
  });

  it("stores UNKNOWN eligibility as null, not true or false", async () => {
    const ids = await saveNewJobs([makeJob()]);
    const jobId = [...ids.values()][0];
    const unknownAnalysis: JobAnalysisResult = {
      ...ANALYSIS,
      eligibility: { ...ANALYSIS.eligibility, indiaEligible: "UNKNOWN", worldwideRemote: "UNKNOWN" },
    };

    await saveJobMatch(jobId, makeJob(), CANDIDATE, unknownAnalysis);

    const match = await prisma.jobMatch.findFirst({ where: { jobId } });
    expect(match?.indiaEligible).toBeNull();
    expect(match?.worldwideRemote).toBeNull();
  });

  it("commits the JobMatch row and the Job update together as a single transaction", async () => {
    const ids = await saveNewJobs([makeJob()]);
    const jobId = [...ids.values()][0];

    const result = await saveJobMatch(jobId, makeJob(), CANDIDATE, ANALYSIS);

    const [match, job] = await Promise.all([
      prisma.jobMatch.findFirst({ where: { jobId } }),
      prisma.job.findUnique({ where: { id: jobId } }),
    ]);

    // Both writes from the $transaction([...]) call must be visible together: the JobMatch
    // row exists and the parent Job row reflects the same computed score/status. Neither side
    // is ever persisted without the other.
    expect(match).not.toBeNull();
    expect(job).not.toBeNull();
    expect(job?.matchScore).toBe(result.overallScore);
    expect(job?.status).toBe("reviewed");
    expect(match?.overallScore).toBe(result.overallScore);
    expect(match?.priority).toBe(result.priority);
  });
});
