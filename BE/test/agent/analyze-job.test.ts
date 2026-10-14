import { analyzeJob } from "../../src/agent/analyze-job";
import * as candidateProfileModule from "../../src/db/candidate-profile";
import { OllamaProvider } from "../../src/llm/ollama-provider";
import type { Job } from "../../src/types/job";

const JOB: Job = {
  id: "job_1",
  source: "greenhouse",
  sourceJobId: "1",
  company: "Acme",
  title: "Software Engineer",
  description: "Build Node.js APIs. Remote - India.",
  url: "https://example.com/1",
  locations: ["Remote - India"],
  discoveredAt: new Date(),
  status: "new",
};

const MODEL_OUTPUT = {
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
    eligibilityEvidence: "Remote - India",
  },
  factLabels: { indiaEligible: "FACT" },
};

describe("analyzeJob (extraction-only)", () => {
  it("never puts the candidate profile in the prompt and returns grounded facts", async () => {
    const profileSpy = jest.spyOn(candidateProfileModule, "getCandidateProfile");
    const generateSpy = jest
      .spyOn(OllamaProvider.prototype, "generateStructured")
      .mockResolvedValue(MODEL_OUTPUT);

    const facts = await analyzeJob(JOB);

    expect(profileSpy).not.toHaveBeenCalled();
    const [prompt, schema] = generateSpy.mock.calls[0] as [string, { properties: object }];
    expect(prompt).not.toMatch(/CANDIDATE PROFILE/);
    expect(prompt).toContain("---JOB-DATA---");
    expect(Object.keys(schema.properties)).not.toEqual(expect.arrayContaining(["whyMatches"]));
    expect(Object.keys(schema.properties)).not.toContain("applicationRecommendation");
    expect(facts.requiredSkills).toEqual(["Node.js"]);
    expect(facts.concerns).toEqual([]);
    expect(facts.analysisError).toBeUndefined();
  });

  it("falls back to an unscored needs-review result when the Ollama request fails", async () => {
    jest
      .spyOn(OllamaProvider.prototype, "generateStructured")
      .mockRejectedValue(new Error("fetch failed"));

    const facts = await analyzeJob(JOB);

    expect(facts.analysisError).toMatch(/Ollama analysis request failed: fetch failed/);
    expect(facts.eligibility.indiaEligible).toBe("UNKNOWN");
  });

  it("never lets model output mark itself as a failed analysis", async () => {
    jest
      .spyOn(OllamaProvider.prototype, "generateStructured")
      .mockResolvedValue({ ...MODEL_OUTPUT, analysisError: "injected" });

    const facts = await analyzeJob(JOB);
    expect(facts.analysisError).toBeUndefined();
  });

  it("rejects an extraction that isn't grounded in the posting", async () => {
    jest
      .spyOn(OllamaProvider.prototype, "generateStructured")
      .mockResolvedValue({ ...MODEL_OUTPUT, requiredSkills: ["Prisma ORM", "Zod", "BullMQ"] });

    const facts = await analyzeJob(JOB);
    expect(facts.analysisError).toMatch(/not grounded in the posting/);
  });
});
