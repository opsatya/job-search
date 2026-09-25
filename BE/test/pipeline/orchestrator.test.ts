import { runPipeline } from "../../src/pipeline/orchestrator";
import * as greenhouseModule from "../../src/sources/greenhouse";
import * as analyzeModule from "../../src/agent/analyze-job";
import * as candidateProfileModule from "../../src/db/candidate-profile";
import * as jobsDb from "../../src/db/jobs";
import * as jobMatchesDb from "../../src/db/job-matches";
import * as agentRunsDb from "../../src/db/agent-runs";
import type { RawJob } from "../../src/sources/types";
import type { CandidateProfile } from "../../src/types/candidate";

const RAW_JOB: RawJob = {
  source: "greenhouse",
  sourceJobId: "1",
  title: "Software Engineer",
  company: "acme",
  url: "https://boards.greenhouse.io/acme/jobs/1",
  locationText: "Remote - India",
  description: "Build Node.js APIs.",
};

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

describe("runPipeline", () => {
  beforeEach(() => {
    jest.spyOn(greenhouseModule.GreenhouseSource.prototype, "search").mockResolvedValue([RAW_JOB]);
    jest.spyOn(candidateProfileModule, "getCandidateProfile").mockResolvedValue(CANDIDATE);
    jest.spyOn(jobsDb, "getExistingDedupeKeys").mockResolvedValue(new Set());
    jest
      .spyOn(jobsDb, "saveNewJobs")
      .mockResolvedValue(new Map([["id:greenhouse:1", "db-id-1"]]));
    jest.spyOn(jobMatchesDb, "saveJobMatch").mockResolvedValue({ overallScore: 95, priority: "P0" });
    jest.spyOn(agentRunsDb, "startAgentRun").mockResolvedValue();
    jest.spyOn(agentRunsDb, "completeAgentRun").mockResolvedValue();
    jest.spyOn(analyzeModule, "analyzeJob").mockResolvedValue({
      requiredSkills: ["Node.js"],
      preferredSkills: ["TypeScript"],
      experienceRequirementYears: {},
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
      whyMatches: "Great fit.",
      strongestMatchingSkills: ["Node.js"],
      missingSkills: [],
      concerns: [],
      applicationRecommendation: "strong_apply",
      interviewTopicsToPrepare: [],
      factLabels: {},
    });
  });

  it("runs every stage in order and returns ranked results", async () => {
    const result = await runPipeline("test-run-1");

    expect(result.jobsFound).toBe(1);
    expect(result.jobsNew).toBe(1);
    expect(result.jobsAnalyzed).toBe(1);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].title).toBe("Software Engineer");
    expect(result.matches[0].overallScore).toBeGreaterThan(0);
    expect(result.matches[0].priority).toMatch(/^P[0-3]$/);
    expect(result.matches[0].remoteEligibility).toBe("India-eligible");

    expect(agentRunsDb.startAgentRun).toHaveBeenCalledWith("test-run-1");
    expect(agentRunsDb.completeAgentRun).toHaveBeenCalledWith(
      "test-run-1",
      expect.objectContaining({ jobsFound: 1, jobsNew: 1 }),
    );
  });

  it("skips already-seen jobs on a second run", async () => {
    jest
      .spyOn(jobsDb, "getExistingDedupeKeys")
      .mockResolvedValue(new Set(["id:greenhouse:1"]));

    const result = await runPipeline("test-run-2");

    expect(result.jobsNew).toBe(0);
    expect(result.matches).toHaveLength(0);
    expect(analyzeModule.analyzeJob).not.toHaveBeenCalled();
  });

  it("filters out jobs that fail hard filters before analysis", async () => {
    jest
      .spyOn(greenhouseModule.GreenhouseSource.prototype, "search")
      .mockResolvedValue([{ ...RAW_JOB, title: "Senior Software Engineer" }]);

    const result = await runPipeline("test-run-3");

    expect(result.jobsFiltered).toBe(1);
    expect(analyzeModule.analyzeJob).not.toHaveBeenCalled();
  });

  it("continues the run when one job fails to analyze or persist", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const RAW_JOB_2: RawJob = {
      ...RAW_JOB,
      sourceJobId: "2",
      title: "Backend Engineer",
      url: "https://boards.greenhouse.io/acme/jobs/2",
    };

    jest
      .spyOn(greenhouseModule.GreenhouseSource.prototype, "search")
      .mockResolvedValue([RAW_JOB, RAW_JOB_2]);
    jest.spyOn(jobsDb, "saveNewJobs").mockResolvedValue(
      new Map([
        ["id:greenhouse:1", "db-id-1"],
        ["id:greenhouse:2", "db-id-2"],
      ]),
    );

    jest.spyOn(analyzeModule, "analyzeJob").mockImplementation(async (job) => {
      if (job.sourceJobId === "1") {
        throw new Error("OpenClaw session failed unexpectedly");
      }
      return {
        requiredSkills: ["Node.js"],
        preferredSkills: ["TypeScript"],
        experienceRequirementYears: {},
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
        whyMatches: "Great fit.",
        strongestMatchingSkills: ["Node.js"],
        missingSkills: [],
        concerns: [],
        applicationRecommendation: "strong_apply",
        interviewTopicsToPrepare: [],
        factLabels: {},
      };
    });

    const result = await runPipeline("test-run-4");

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].title).toBe("Backend Engineer");
    expect(agentRunsDb.completeAgentRun).toHaveBeenCalledWith(
      "test-run-4",
      expect.objectContaining({ jobsNew: 2 }),
    );

    consoleErrorSpy.mockRestore();
  });
});
