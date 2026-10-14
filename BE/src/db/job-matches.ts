import { prisma } from "./client";
import { scoreJob, calculateOverallScore, categorize } from "../pipeline/scoring";
import { explainMatch } from "../pipeline/explain";
import type { JobFacts, MatchExplanation, Tri, PriorityTier } from "../pipeline/scoring";
import type { CandidateProfile } from "../types/candidate";
import type { Job } from "../types/job";

function triToDb(value: Tri): boolean | null {
  return value === "UNKNOWN" ? null : value;
}

export async function saveJobMatch(
  jobId: string,
  job: Job,
  candidate: CandidateProfile,
  facts: JobFacts,
): Promise<{ overallScore: number | null; priority: PriorityTier | null }> {
  if (facts.analysisError) {
    // Spec §13: a failed analysis carries no real facts, so scoring it would
    // invent a ranking. Persist what we have, unscored, and leave the job
    // "new" so it stays visibly awaiting review.
    // A retry replaces the previous attempt's row rather than piling up rows.
    await prisma.$transaction([
      prisma.jobMatch.deleteMany({ where: { jobId } }),
      prisma.jobMatch.create({
        data: {
          jobId,
          ...factColumns(facts),
          ...explanationColumns({
            whyMatches: "",
            strongestMatchingSkills: [],
            missingSkills: [],
            concerns: facts.concerns,
            applicationRecommendation: "needs_review",
            interviewTopicsToPrepare: [],
          }),
        },
      }),
      prisma.job.update({ where: { id: jobId }, data: { analysisAttempts: { increment: 1 } } }),
    ]);
    return { overallScore: null, priority: null };
  }

  const scores = scoreJob(candidate, job, facts);
  const overallScore = calculateOverallScore(scores);
  const priority = categorize(overallScore);
  const explanation = explainMatch(candidate, job, facts, priority);

  await prisma.$transaction([
    prisma.jobMatch.deleteMany({ where: { jobId } }),
    prisma.jobMatch.create({
      data: {
        jobId,
        skillMatch: scores.skillMatch,
        experienceMatch: scores.experienceMatch,
        locationMatch: scores.locationMatch,
        seniorityMatch: scores.seniorityMatch,
        educationMatch: scores.educationMatch,
        salaryMatch: scores.salaryMatch,
        domainMatch: scores.domainMatch,
        overallScore,
        priority,
        ...factColumns(facts),
        ...explanationColumns(explanation),
      },
    }),
    prisma.job.update({
      where: { id: jobId },
      data: {
        matchScore: overallScore,
        status: "reviewed",
        analysisAttempts: { increment: 1 },
      },
    }),
  ]);

  return { overallScore, priority };
}

function factColumns(facts: JobFacts) {
  return {
    requiredSkills: facts.requiredSkills,
    preferredSkills: facts.preferredSkills,
    seniorityLevel: facts.seniorityLevel,
    educationRequirement: facts.educationRequirement,
    domain: facts.domain,
    factLabels: facts.factLabels,
    remoteStatus: facts.eligibility.remoteStatus,
    indiaEligible: triToDb(facts.eligibility.indiaEligible),
    worldwideRemote: triToDb(facts.eligibility.worldwideRemote),
    locationRestriction: facts.eligibility.locationRestriction,
    visaRequired: triToDb(facts.eligibility.visaRequired),
    relocationRequired: triToDb(facts.eligibility.relocationRequired),
    eligibilityConfidence: facts.eligibility.eligibilityConfidence,
    eligibilityEvidence: facts.eligibility.eligibilityEvidence,
    salaryEvidence: facts.eligibility.salaryEvidence,
  };
}

function explanationColumns(explanation: MatchExplanation) {
  return {
    whyMatches: explanation.whyMatches,
    strongestMatchingSkills: explanation.strongestMatchingSkills,
    missingSkills: explanation.missingSkills,
    experienceGap: explanation.experienceGap,
    concerns: explanation.concerns,
    applicationRecommendation: explanation.applicationRecommendation,
    interviewTopics: explanation.interviewTopicsToPrepare,
  };
}
