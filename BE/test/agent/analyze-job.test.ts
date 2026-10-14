// BE/test/agent/analyze-job.test.ts
import { analyzeJob } from "../../src/agent/analyze-job";
import * as candidateProfileModule from "../../src/db/candidate-profile";
import { OllamaProvider } from "../../src/llm/ollama-provider";
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

describe("analyzeJob (direct Ollama structured-output branch)", () => {
  it("calls Ollama with a schema constraint and returns the parsed analysis", async () => {
    jest.spyOn(candidateProfileModule, "getCandidateProfile").mockResolvedValue({
      name: "Satyajeet Singh",
    } as never);
    const generateSpy = jest
      .spyOn(OllamaProvider.prototype, "generateStructured")
      .mockResolvedValue(ANALYSIS);

    const result = await analyzeJob(JOB);

    expect(generateSpy).toHaveBeenCalledWith(
      expect.stringContaining("Software Engineer"),
      expect.objectContaining({ type: "object" }),
    );
    expect(result).toEqual(ANALYSIS);
  });

  it("falls back to needs_review with UNKNOWN eligibility when the Ollama request fails", async () => {
    jest.spyOn(candidateProfileModule, "getCandidateProfile").mockResolvedValue({
      name: "Satyajeet Singh",
    } as never);
    jest
      .spyOn(OllamaProvider.prototype, "generateStructured")
      .mockRejectedValue(new Error("Failed to parse Ollama response as JSON: not json"));

    const result = await analyzeJob(JOB);

    expect(result.applicationRecommendation).toBe("needs_review");
    expect(result.eligibility.indiaEligible).toBe("UNKNOWN");
  });
});
