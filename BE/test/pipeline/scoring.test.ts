import {
  scoreSkillMatch,
  scoreExperienceMatch,
  scoreLocationMatch,
  scoreSeniorityMatch,
  scoreEducationMatch,
  scoreSalaryMatch,
  scoreDomainMatch,
  scoreJob,
  calculateOverallScore,
  categorize,
} from "../../src/pipeline/scoring";
import type { CandidateProfile } from "../../src/types/candidate";
import type { Job } from "../../src/types/job";
import type { JobAnalysisResult } from "../../src/pipeline/scoring";

const CANDIDATE: CandidateProfile = {
  name: "Satyajeet Singh",
  location: "Pune, Maharashtra, India",
  education: { degree: "MCA", university: "SPPU", status: "completed", cgpa: 7.91 },
  experience: { months: 10, production: true },
  primaryRoles: ["Software Engineer"],
  secondaryRoles: [],
  skills: {
    languages: ["TypeScript", "JavaScript"],
    backend: ["Node.js", "Fastify", "PostgreSQL", "Prisma ORM"],
    frontend: ["React"],
    databases: ["PostgreSQL", "Redis"],
    cloudDevOps: ["AWS EC2", "Docker"],
    architecture: [],
  },
  preferences: {
    remotePreferred: true,
    locations: ["Pune", "Bangalore"],
    internationalRemote: true,
    salaryFloorLpa: 5,
    salaryTargetLpa: 6,
    salaryPreferredLpa: 8,
    startupFriendly: true,
    productCompanyPreferred: true,
  },
};

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "x",
    source: "greenhouse",
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

function makeFacts(overrides: Partial<JobAnalysisResult> = {}): JobAnalysisResult {
  return {
    requiredSkills: ["TypeScript", "Node.js"],
    preferredSkills: ["React"],
    experienceRequirementYears: { min: 1, max: 2 },
    seniorityLevel: "junior",
    educationRequirement: undefined,
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
    whyMatches: "",
    strongestMatchingSkills: [],
    missingSkills: [],
    concerns: [],
    applicationRecommendation: "strong_apply",
    interviewTopicsToPrepare: [],
    factLabels: {},
    ...overrides,
  };
}

describe("scoreSkillMatch", () => {
  it("gives full points when all required and preferred skills are demonstrated", () => {
    const facts = makeFacts({ requiredSkills: ["TypeScript", "Node.js"], preferredSkills: ["React"] });
    expect(scoreSkillMatch(CANDIDATE, facts)).toBe(30);
  });

  it("gives zero when the candidate has no listed skills at all matching", () => {
    const facts = makeFacts({ requiredSkills: ["Rust"], preferredSkills: ["Elixir"] });
    expect(scoreSkillMatch(CANDIDATE, facts)).toBe(0);
  });

  it("gives full required credit when requiredSkills is empty", () => {
    const facts = makeFacts({ requiredSkills: [], preferredSkills: [] });
    expect(scoreSkillMatch(CANDIDATE, facts)).toBe(30);
  });

  it("weights required and preferred skills separately on a partial match", () => {
    // 1 of 2 required (TypeScript matches, Rust doesn't), 0 of 1 preferred (Elixir doesn't).
    const facts = makeFacts({ requiredSkills: ["TypeScript", "Rust"], preferredSkills: ["Elixir"] });
    expect(scoreSkillMatch(CANDIDATE, facts)).toBe(Math.round(0.5 * 22 + 0 * 8));
    expect(scoreSkillMatch(CANDIDATE, facts)).toBe(11);
  });
});

describe("scoreExperienceMatch", () => {
  it("gives full points when the candidate meets the minimum", () => {
    const facts = makeFacts({ experienceRequirementYears: { min: 0.5 } });
    expect(scoreExperienceMatch(CANDIDATE, facts)).toBe(20);
  });

  it("gives full points when no minimum is stated", () => {
    const facts = makeFacts({ experienceRequirementYears: {} });
    expect(scoreExperienceMatch(CANDIDATE, facts)).toBe(20);
  });

  it("gives zero when the gap is 2 years or more", () => {
    const facts = makeFacts({ experienceRequirementYears: { min: 3 } }); // candidate has ~0.83y, gap >= 2
    expect(scoreExperienceMatch(CANDIDATE, facts)).toBe(0);
  });

  it("falls off linearly for a mid-range gap", () => {
    // candidate has 10 months (~0.833y); min 1.833y gives a gap of exactly 1 year (half of the
    // 2-year zero-point), so the score should be exactly half of 20.
    const facts = makeFacts({ experienceRequirementYears: { min: 1.833333333333 } });
    expect(scoreExperienceMatch(CANDIDATE, facts)).toBe(Math.round(20 * (1 - 1 / 2)));
    expect(scoreExperienceMatch(CANDIDATE, facts)).toBe(10);
  });
});

describe("scoreLocationMatch", () => {
  it("gives full points when explicitly India-eligible remote", () => {
    const facts = makeFacts({
      eligibility: { ...makeFacts().eligibility, indiaEligible: true },
    });
    expect(scoreLocationMatch(CANDIDATE, makeJob(), facts)).toBe(20);
  });

  it("gives partial credit — neither zero nor full — when eligibility is UNKNOWN", () => {
    const facts = makeFacts({
      eligibility: {
        ...makeFacts().eligibility,
        indiaEligible: "UNKNOWN",
        worldwideRemote: "UNKNOWN",
      },
    });
    const score = scoreLocationMatch(CANDIDATE, makeJob(), facts);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(20);
  });

  it("gives a low but nonzero score when explicitly restricted to a non-India-eligible location", () => {
    const facts = makeFacts({
      eligibility: {
        ...makeFacts().eligibility,
        indiaEligible: false,
        worldwideRemote: false,
        locationRestriction: "UK only",
      },
    });
    expect(scoreLocationMatch(CANDIDATE, makeJob(), facts)).toBe(2);
  });

  it("gives partial credit — not the confirmed-restricted score — when indiaEligible is UNKNOWN even though worldwideRemote is confirmed false", () => {
    const facts = makeFacts({
      eligibility: {
        ...makeFacts().eligibility,
        indiaEligible: "UNKNOWN",
        worldwideRemote: false,
      },
    });
    const score = scoreLocationMatch(CANDIDATE, makeJob(), facts);
    expect(score).toBe(10);
    expect(score).not.toBe(2);
  });

  it("still gives the confirmed-restricted score when indiaEligible is false even though worldwideRemote is UNKNOWN (regression guard)", () => {
    const facts = makeFacts({
      eligibility: {
        ...makeFacts().eligibility,
        indiaEligible: false,
        worldwideRemote: "UNKNOWN",
      },
    });
    expect(scoreLocationMatch(CANDIDATE, makeJob(), facts)).toBe(2);
  });

  it("scores an onsite job against the candidate's preferred cities", () => {
    const facts = makeFacts({ eligibility: { ...makeFacts().eligibility, remoteStatus: "onsite" } });
    const preferredCityJob = makeJob({ locations: ["Pune, India"] });
    const otherCityJob = makeJob({ locations: ["Berlin, Germany"] });
    expect(scoreLocationMatch(CANDIDATE, preferredCityJob, facts)).toBe(18);
    expect(scoreLocationMatch(CANDIDATE, otherCityJob, facts)).toBe(5);
  });
});

describe("scoreSeniorityMatch", () => {
  it.each([
    ["junior", 15],
    ["unclear", 10],
    ["mid", 6],
    ["senior", 0],
  ])("scores seniorityLevel %s as %d", (level, expected) => {
    const facts = makeFacts({ seniorityLevel: level as JobAnalysisResult["seniorityLevel"] });
    expect(scoreSeniorityMatch(facts)).toBe(expected);
  });
});

describe("scoreEducationMatch", () => {
  it("gives full points when no education requirement is stated", () => {
    expect(scoreEducationMatch(makeFacts({ educationRequirement: undefined }))).toBe(5);
  });

  it("gives full points when the requirement matches the candidate's degree", () => {
    expect(scoreEducationMatch(makeFacts({ educationRequirement: "Bachelor's degree in CS" }))).toBe(5);
  });

  it("gives a small nonzero score for an unrecognized requirement", () => {
    expect(scoreEducationMatch(makeFacts({ educationRequirement: "PhD in Physics" }))).toBe(2);
  });
});

describe("scoreSalaryMatch", () => {
  it("gives a neutral default when salary is undisclosed", () => {
    expect(scoreSalaryMatch(CANDIDATE, makeJob())).toBe(3);
  });

  it("gives full points when salary meets the preferred level", () => {
    const job = makeJob({ salaryMin: 8, salaryMax: 10, salaryCurrency: "INR_LPA" });
    expect(scoreSalaryMatch(CANDIDATE, job)).toBe(5);
  });

  it("gives a low but nonzero score when below the floor", () => {
    const job = makeJob({ salaryMin: 4, salaryMax: 4, salaryCurrency: "INR_LPA" });
    expect(scoreSalaryMatch(CANDIDATE, job)).toBe(1);
  });
});

describe("scoreDomainMatch", () => {
  it("gives full points for a positive-signal domain", () => {
    expect(scoreDomainMatch(makeFacts({ domain: "SaaS" }))).toBe(5);
  });

  it("gives a neutral default when domain is unstated", () => {
    expect(scoreDomainMatch(makeFacts({ domain: undefined }))).toBe(3);
  });

  it("gives a low score for an unrecognized domain", () => {
    expect(scoreDomainMatch(makeFacts({ domain: "Mining Equipment" }))).toBe(2);
  });
});

describe("scoreJob + calculateOverallScore + categorize", () => {
  it("combines all seven categories into a 0-100 overall score", () => {
    const scores = scoreJob(CANDIDATE, makeJob(), makeFacts());
    const overall = calculateOverallScore(scores);
    expect(overall).toBe(
      scores.skillMatch +
        scores.experienceMatch +
        scores.locationMatch +
        scores.seniorityMatch +
        scores.educationMatch +
        scores.salaryMatch +
        scores.domainMatch,
    );
    expect(overall).toBeLessThanOrEqual(100);
  });

  it.each([
    [95, "P0"],
    [85, "P1"],
    [70, "P2"],
    [40, "P3"],
  ])("categorizes %d as %s", (score, expected) => {
    expect(categorize(score)).toBe(expected);
  });
});
