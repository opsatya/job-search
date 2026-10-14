import { formatResultsForDisplay, markRunInterrupted } from "../../src/cli/agent-run";
import * as agentRunsDb from "../../src/db/agent-runs";
import type { PipelineResult } from "../../src/pipeline/orchestrator";

describe("formatResultsForDisplay", () => {
  it("matches the spec's CLI output format", () => {
    const result: PipelineResult = {
      sourcesChecked: 1,
      jobsFound: 47,
      jobsNew: 21,
      jobsFiltered: 10,
      jobsAnalyzed: 11,
      jobsNeedingReview: 2,
      jobsRetried: 3,
      matches: [
        {
          title: "Full Stack Engineer",
          company: "Company A",
          location: "Remote India",
          salary: "6-8 LPA",
          remoteEligibility: "India-eligible",
          overallScore: 94,
          priority: "P0",
        },
      ],
    };

    const output = formatResultsForDisplay(result);

    expect(output).toContain("Jobs found: 47");
    expect(output).toContain("New jobs: 21");
    expect(output).toContain("Filtered: 10");
    expect(output).toContain("Analyzed: 11");
    expect(output).toContain("Needs review (analysis failed): 2");
    expect(output).toContain("Retried (earlier failed analyses): 3");
    expect(output).toContain("P0 94% — Full Stack Engineer — Company A — India-eligible");
  });
});

describe("markRunInterrupted", () => {
  it("marks the run failed with the signal that interrupted it", async () => {
    const failSpy = jest.spyOn(agentRunsDb, "failAgentRun").mockResolvedValue();

    await markRunInterrupted("run-x", "SIGINT");

    expect(failSpy).toHaveBeenCalledWith("run-x", "interrupted by SIGINT");
  });

  it("does not throw if the run row was never created", async () => {
    jest.spyOn(agentRunsDb, "failAgentRun").mockRejectedValue(new Error("Record not found"));

    await expect(markRunInterrupted("run-y", "SIGTERM")).resolves.toBeUndefined();
  });
});
