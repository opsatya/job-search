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

  describe("eligibility claims", () => {
    function withEligibility(
      eligibility: Partial<JobAnalysisResult["eligibility"]>,
    ): JobAnalysisResult {
      const base = analysis({});
      return { ...base, eligibility: { ...base.eligibility, ...eligibility } };
    }

    it("downgrades true claims to UNKNOWN when the evidence and locations don't support them", () => {
      // Real run: evidence "Remote, United Kingdom" came back India- and worldwide-eligible.
      const result = groundAnalysis(
        { ...JOB, locations: ["Remote, United Kingdom"] },
        withEligibility({
          indiaEligible: true,
          worldwideRemote: true,
          eligibilityEvidence: "Remote, United Kingdom",
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.analysis.eligibility.indiaEligible).toBe("UNKNOWN");
      expect(result.analysis.eligibility.worldwideRemote).toBe("UNKNOWN");
      expect(result.analysis.concerns).toEqual([
        "Eligibility claims not supported by the posting's evidence or locations, set to UNKNOWN: indiaEligible, worldwideRemote",
      ]);
    });

    it("keeps an India claim backed by the job's structured location", () => {
      const result = groundAnalysis(
        {
          ...JOB,
          locations: ["Bangalore, India"],
          description: `${JOB.description} All of our roles are remote.`,
        },
        withEligibility({
          indiaEligible: true,
          eligibilityEvidence: "All of our roles are remote.",
        }),
      );
      expect(result.ok && result.analysis.eligibility.indiaEligible).toBe(true);
    });

    it("keeps a worldwide claim whose evidence says so", () => {
      const result = groundAnalysis(
        { ...JOB, locations: ["Remote-Global"] },
        withEligibility({ worldwideRemote: true, eligibilityEvidence: "Remote-Global" }),
      );
      expect(result.ok && result.analysis.eligibility.worldwideRemote).toBe(true);
    });

    it("downgrades true claims whose evidence is not a quote from the posting", () => {
      const result = groundAnalysis(
        { ...JOB, locations: ["Bangalore, India"] },
        withEligibility({
          indiaEligible: true,
          eligibilityEvidence: "Open to candidates in India",
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.analysis.eligibility.indiaEligible).toBe("UNKNOWN");
      expect(result.analysis.concerns).toContain(
        "Eligibility evidence is not a quote from the posting; true claims set to UNKNOWN",
      );
    });

    it("never changes false or UNKNOWN claims", () => {
      const result = groundAnalysis(
        JOB,
        withEligibility({
          indiaEligible: false,
          worldwideRemote: "UNKNOWN",
          eligibilityEvidence: "US only",
        }),
      );
      expect(result.ok && result.analysis.eligibility).toEqual(
        expect.objectContaining({ indiaEligible: false, worldwideRemote: "UNKNOWN" }),
      );
      expect(result.ok && result.analysis.concerns).toEqual([]);
    });
  });
});
