// Times analyzeJob on fixed real postings without saving anything. Run it
// before and after the extraction-only change (spec §6.4, acceptance item 6).
import { prisma } from "../src/db/client";
import { analyzeJob } from "../src/agent/analyze-job";
import type { Job } from "../src/types/job";

const TITLES = [
  "Software Engineer - Machine Learning (London, United Kingdom)",
  "Software Engineer - Mobile Web",
  "Backend Engineer, Create: Repository Management",
  "Backend Engineer, AI Engineering: Duo Chat",
  "Software Engineer - Full Stack",
  "Intermediate Backend Engineer - Database Change Management",
];

async function main(): Promise<void> {
  const rows = await prisma.job.findMany({ where: { title: { in: TITLES } } });
  let totalMs = 0;
  for (const row of rows) {
    const job = {
      ...row,
      sourceJobId: row.sourceJobId ?? undefined,
      locations: row.locations,
    } as unknown as Job;
    const start = Date.now();
    const facts = await analyzeJob(job);
    const ms = Date.now() - start;
    totalMs += ms;
    const flags = (facts as { concerns?: string[] }).concerns ?? [];
    console.log(
      `${String(ms).padStart(7)} ms | ${facts.analysisError ? "FAILED" : "ok    "} | flags=${flags.length} | ${row.title}` +
        (facts.analysisError ? `\n          ${facts.analysisError}` : ""),
    );
  }
  console.log(`avg ${Math.round(totalMs / Math.max(rows.length, 1))} ms over ${rows.length} jobs`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
