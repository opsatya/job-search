import { prisma } from "../../src/db/client";
import {
  startAgentRun,
  completeAgentRun,
  failAgentRun,
  failAbandonedRuns,
} from "../../src/db/agent-runs";

// Scoped to this file's own fixture runId rather than wiping the whole
// table — see the comment in test/db/jobs.test.ts for why an unscoped
// deleteMany() is unsafe against a DATABASE_URL that also holds real
// agent_runs history.
const TEST_RUN_ID = "run-1";
const OTHER_RUN_ID = "run-1-other";

describe("agent run tracking", () => {
  beforeEach(async () => {
    await prisma.agentRun.deleteMany({ where: { runId: { in: [TEST_RUN_ID, OTHER_RUN_ID] } } });
  });
  afterEach(async () => {
    await prisma.agentRun.deleteMany({ where: { runId: { in: [TEST_RUN_ID, OTHER_RUN_ID] } } });
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

  it("marks runs left in_progress by a killed process as failed, except the current run", async () => {
    // Note: this sweeps any in_progress run in the shared DB, which is the
    // intended production behaviour too (agent:run is single-instance).
    await startAgentRun(TEST_RUN_ID);
    await startAgentRun(OTHER_RUN_ID);

    const count = await failAbandonedRuns(OTHER_RUN_ID);

    expect(count).toBeGreaterThanOrEqual(1);
    const stale = await prisma.agentRun.findUnique({ where: { runId: TEST_RUN_ID } });
    expect(stale?.status).toBe("failed");
    expect(stale?.error).toMatch(/abandoned/);
    const current = await prisma.agentRun.findUnique({ where: { runId: OTHER_RUN_ID } });
    expect(current?.status).toBe("in_progress");
  });
});
