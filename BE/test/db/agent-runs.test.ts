import { prisma } from "../../src/db/client";
import { startAgentRun, completeAgentRun } from "../../src/db/agent-runs";

describe("agent run tracking", () => {
  afterEach(async () => {
    await prisma.agentRun.deleteMany();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("starts a run in-progress and completes it with stats", async () => {
    await startAgentRun("run-1");
    let run = await prisma.agentRun.findUnique({ where: { runId: "run-1" } });
    expect(run?.status).toBe("in_progress");

    await completeAgentRun("run-1", {
      sourcesChecked: 1,
      jobsFound: 10,
      jobsNew: 5,
      jobsFiltered: 3,
      jobsAnalyzed: 3,
      strongMatches: 1,
    });

    run = await prisma.agentRun.findUnique({ where: { runId: "run-1" } });
    expect(run?.status).toBe("completed");
    expect(run?.jobsFound).toBe(10);
    expect(run?.completedAt).not.toBeNull();
  });
});
