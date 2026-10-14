import { explainMatch } from "../../src/pipeline/explain";
import type { JobFacts } from "../../src/pipeline/scoring";
import type { CandidateProfile } from "../../src/types/candidate";
import type { Job } from "../../src/types/job";

const CANDIDATE = {
  experience: { months: 10, production: true },
  skills: {
    languages: ["TypeScript"],
    backend: ["Node.js", "PostgreSQL"],
    frontend: ["React"],
    databases: [],
    cloudDevOps: [],
    architecture: [],
  },
} as unknown as CandidateProfile;

const JOB = { title: "Backend Engineer", salaryMin: undefined, salaryMax: undefined } as Job;

function facts(overrides: Partial<JobFacts> = {}): JobFacts {
  return {
    requiredSkills: ["Node.js", "TypeScript", "Go"],
    preferredSkills: ["React"],
    experienceRequirementYears: { min: 2 },
    seniorityLevel: "junior",
    eligibility: {
      remoteStatus: "remote",
      indiaEligible: true,
      worldwideRemote: "UNKNOWN",
      visaRequired: "UNKNOWN",
      relocationRequired: "UNKNOWN",
      eligibilityConfidence: "high",
      eligibilityEvidence: "Remote - India",
    },
    factLabels: {},
    concerns: ["Dropped extracted skills not found in the job posting: GraphQL"],
    ...overrides,
  };
}

describe("explainMatch", () => {
  it("builds a factual explanation from code-derived skills, experience, and evidence", () => {
    const result = explainMatch(CANDIDATE, JOB, facts(), "P1");

    expect(result.strongestMatchingSkills).toEqual(["Node.js", "TypeScript", "React"]);
    expect(result.missingSkills).toEqual(["Go"]);
    expect(result.whyMatches).toBe(
      "Matches 2 of 3 required skills (Node.js, TypeScript). Missing: Go. " +
        "Experience: asks 2+ yrs; you have 0.8. India eligibility: yes — evidence: 'Remote - India'.",
    );
    expect(result.experienceGap).toBe("Asks 2+ yrs; you have 0.8");
    expect(result.applicationRecommendation).toBe("apply");
    expect(result.interviewTopicsToPrepare).toEqual(["Node.js", "TypeScript", "Go"]);
    expect(result.concerns).toEqual([
      "Dropped extracted skills not found in the job posting: GraphQL",
      "Experience gap: asks 2+ yrs; you have 0.8",
      "Salary not disclosed",
    ]);
  });

  it.each([
    [{ indiaEligible: false, worldwideRemote: false }, "P0", "skip"],
    [{ indiaEligible: "UNKNOWN", worldwideRemote: "UNKNOWN" }, "P3", "skip"],
    [{ indiaEligible: "UNKNOWN", worldwideRemote: "UNKNOWN" }, "P1", "needs_review"],
    [{ indiaEligible: "UNKNOWN", worldwideRemote: true }, "P0", "strong_apply"],
    [{ indiaEligible: true, worldwideRemote: "UNKNOWN" }, "P2", "consider"],
  ] as const)("recommendation for %o at %s is %s", (eligibility, priority, expected) => {
    const f = facts({ eligibility: { ...facts().eligibility, ...eligibility } });
    expect(explainMatch(CANDIDATE, JOB, f, priority).applicationRecommendation).toBe(expected);
  });

  it("omits the experience gap when the candidate meets the minimum or none is stated", () => {
    const result = explainMatch(CANDIDATE, JOB, facts({ experienceRequirementYears: {} }), "P2");
    expect(result.experienceGap).toBeUndefined();
    expect(result.whyMatches).toContain("Experience: not stated.");
  });
});
