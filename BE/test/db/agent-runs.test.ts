import { prisma } from "../../src/db/client";
import { startAgentRun, completeAgentRun, failAgentRun } from "../../src/db/agent-runs";

// Scoped to this file's own fixture runId rather than wiping the whole
// table — see the comment in test/db/jobs.test.ts for why an unscoped
// deleteMany() is unsafe against a DATABASE_URL that also holds real
// agent_runs history.
const TEST_RUN_ID = "run-1";

describe("agent run tracking", () => {
  beforeEach(async () => {
    await prisma.agentRun.deleteMany({ where: { runId: TEST_RUN_ID } });
  });
  afterEach(async () => {
    await prisma.agentRun.deleteMany({ where: { runId: TEST_RUN_ID } });
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

  it("marks a run failed with the error that ended it", async () => {
    await startAgentRun(TEST_RUN_ID);

    await failAgentRun(TEST_RUN_ID, "Greenhouse fetch failed: ECONNRESET");

    const run = await prisma.agentRun.findUnique({ where: { runId: TEST_RUN_ID } });
    expect(run?.status).toBe("failed");
    expect(run?.error).toBe("Greenhouse fetch failed: ECONNRESET");
    expect(run?.completedAt).not.toBeNull();
  });
});
