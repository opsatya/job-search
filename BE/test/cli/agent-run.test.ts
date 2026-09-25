import { formatResultsForDisplay } from "../../src/cli/agent-run";
import type { PipelineResult } from "../../src/pipeline/orchestrator";

describe("formatResultsForDisplay", () => {
  it("matches the spec's CLI output format", () => {
    const result: PipelineResult = {
      sourcesChecked: 1,
      jobsFound: 47,
      jobsNew: 21,
      jobsFiltered: 10,
      jobsAnalyzed: 11,
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
    expect(output).toContain("P0 94% — Full Stack Engineer — Company A — India-eligible");
  });
});
