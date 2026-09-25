import { prisma } from "./client";

export interface AgentRunStats {
  sourcesChecked: number;
  jobsFound: number;
  jobsNew: number;
  jobsFiltered: number;
  jobsAnalyzed: number;
  strongMatches: number;
}

export async function startAgentRun(runId: string): Promise<void> {
  await prisma.agentRun.create({
    data: {
      runId,
      status: "in_progress",
      sourcesChecked: 0,
      jobsFound: 0,
      jobsNew: 0,
      jobsFiltered: 0,
      jobsAnalyzed: 0,
      strongMatches: 0,
    },
  });
}

export async function completeAgentRun(runId: string, stats: AgentRunStats): Promise<void> {
  await prisma.agentRun.update({
    where: { runId },
    data: {
      status: "completed",
      completedAt: new Date(),
      ...stats,
    },
  });
}
