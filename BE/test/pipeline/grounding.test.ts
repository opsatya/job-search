import { groundAnalysis } from "../../src/pipeline/grounding";
import type { JobAnalysisResult } from "../../src/pipeline/scoring";
import type { Job } from "../../src/types/job";

const JOB: Job = {
  id: "x",
  source: "greenhouse",
  company: "Acme",
  title: "Backend Engineer (Node.js)",
  description:
    "You'll build REST API services in TypeScript on Postgres, with Kafka for streaming. Bonus: Python.",
  url: "https://example.com/1",
  locations: ["Remote"],
  discoveredAt: new Date(),
  status: "new",
};

function analysis(overrides: Partial<JobAnalysisResult>): JobAnalysisResult {
  return {
    requiredSkills: [],
    preferredSkills: [],
    experienceRequirementYears: {},
    seniorityLevel: "junior",
    eligibility: {
      remoteStatus: "remote",
      indiaEligible: "UNKNOWN",
      worldwideRemote: "UNKNOWN",
      visaRequired: "UNKNOWN",
      relocationRequired: "UNKNOWN",
      eligibilityConfidence: "low",
      eligibilityEvidence: "Remote",
    },
    whyMatches: "",
    strongestMatchingSkills: [],
    missingSkills: [],
    concerns: [],
    applicationRecommendation: "consider",
    interviewTopicsToPrepare: [],
    factLabels: {},
    ...overrides,
  };
}

describe("groundAnalysis", () => {
  it("keeps skills that appear in the posting, tolerating spelling variants", () => {
    const result = groundAnalysis(
      JOB,
      analysis({
        requiredSkills: ["REST APIs", "typescript", "Node.js"],
        preferredSkills: ["Python"],
      }),
    );

    expect(result).toEqual({
      ok: true,
      analysis: expect.objectContaining({
        requiredSkills: ["REST APIs", "typescript", "Node.js"],
        preferredSkills: ["Python"],
        concerns: [],
      }),
    });
  });

  it("drops a minority of skills the posting never mentions and records them as a concern", () => {
    const result = groundAnalysis(
      JOB,
      analysis({ requiredSkills: ["TypeScript", "Kafka", "GraphQL"], preferredSkills: ["Python"] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.requiredSkills).toEqual(["TypeScript", "Kafka"]);
    expect(result.analysis.preferredSkills).toEqual(["Python"]);
    expect(result.analysis.concerns).toEqual([
      "Dropped extracted skills not found in the job posting: GraphQL",
    ]);
  });

  it("rejects an extraction that is mostly not in the posting, e.g. the candidate's own skills copied in", () => {
    // Real run: the model filled an ML job's requiredSkills with the
    // candidate's profile (Prisma ORM, Zod, BullMQ...), scoring it P1.
    const result = groundAnalysis(
      JOB,
      analysis({ requiredSkills: ["Prisma ORM", "Zod", "BullMQ", "TypeScript"] }),
    );

    expect(result).toEqual({
      ok: false,
      reason:
        "Extraction not grounded in the posting: 3 of 4 extracted skills are not in the job description",
    });
  });

  it("matches an aliased spelling when the posting uses the short form", () => {
    const result = groundAnalysis(JOB, analysis({ requiredSkills: ["PostgreSQL"] }));
    expect(result.ok && result.analysis.requiredSkills).toEqual(["PostgreSQL"]);
  });
});
