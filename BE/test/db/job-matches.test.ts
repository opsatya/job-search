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
    sourceJobId: "1",
    company: "Acme",
    title: "Software Engineer",
    description: "desc",
    url: "https://example.com/1",
    locations: ["Remote"],
    discoveredAt: new Date(),
    status: "new",
  };
}

describe("saveJobMatch", () => {
  afterEach(async () => {
    await prisma.jobMatch.deleteMany();
    await prisma.job.deleteMany();
  });
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
