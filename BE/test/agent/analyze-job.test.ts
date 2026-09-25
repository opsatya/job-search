// BE/test/agent/analyze-job.test.ts
import { analyzeJob } from "../../src/agent/analyze-job";
import * as candidateProfileModule from "../../src/db/candidate-profile";
import * as openclawModule from "../../src/agent/openclaw-client";
import type { Job } from "../../src/types/job";
import type { JobAnalysisResult } from "../../src/pipeline/scoring";

const JOB: Job = {
  id: "job_1",
  source: "greenhouse",
  sourceJobId: "1",
  company: "Acme",
  title: "Software Engineer",
  description: "Build Node.js APIs. Remote - India.",
  url: "https://example.com/1",
  locations: ["Remote"],
  discoveredAt: new Date(),
  status: "new",
};

const ANALYSIS: JobAnalysisResult = {
  requiredSkills: ["Node.js"],
  preferredSkills: [],
  experienceRequirementYears: {},
  seniorityLevel: "junior",
  eligibility: {
    remoteStatus: "remote",
    indiaEligible: true,
    worldwideRemote: false,
    visaRequired: false,
    relocationRequired: false,
    eligibilityConfidence: "high",
    eligibilityEvidence: "Job posting states: Remote - India",
  },
  whyMatches: "Good fit.",
  strongestMatchingSkills: ["Node.js"],
  missingSkills: [],
  concerns: [],
  applicationRecommendation: "strong_apply",
  interviewTopicsToPrepare: [],
  factLabels: { indiaEligible: "FACT" },
};

describe("analyzeJob (OpenClaw branch)", () => {
  it("calls OpenClaw with the candidate profile and job, scoped to the analysis tool allowlist", async () => {
    jest.spyOn(candidateProfileModule, "getCandidateProfile").mockResolvedValue({
      name: "Satyajeet Singh",
    } as never);
    const runSpy = jest
      .spyOn(openclawModule, "runOpenClawSession")
      .mockResolvedValue(JSON.stringify(ANALYSIS));

    const result = await analyzeJob(JOB);

    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [],
        model: "ollama/llama3.1",
      }),
    );
    expect(result).toEqual(ANALYSIS);
  });

  it("falls back to needs_review with UNKNOWN eligibility when OpenClaw returns malformed JSON", async () => {
    jest.spyOn(candidateProfileModule, "getCandidateProfile").mockResolvedValue({
      name: "Satyajeet Singh",
    } as never);
    jest.spyOn(openclawModule, "runOpenClawSession").mockResolvedValue("not json");

    const result = await analyzeJob(JOB);

    expect(result.applicationRecommendation).toBe("needs_review");
    expect(result.eligibility.indiaEligible).toBe("UNKNOWN");
  });
});
