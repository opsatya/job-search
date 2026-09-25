import { prisma } from "./client";
import { scoreJob, calculateOverallScore, categorize } from "../pipeline/scoring";
import type { JobAnalysisResult, Tri, PriorityTier } from "../pipeline/scoring";
import type { CandidateProfile } from "../types/candidate";
import type { Job } from "../types/job";

function triToDb(value: Tri): boolean | null {
  return value === "UNKNOWN" ? null : value;
}

export async function saveJobMatch(
  jobId: string,
  job: Job,
  candidate: CandidateProfile,
  analysis: JobAnalysisResult,
): Promise<{ overallScore: number; priority: PriorityTier }> {
  const scores = scoreJob(candidate, job, analysis);
  const overallScore = calculateOverallScore(scores);
  const priority = categorize(overallScore);

  await prisma.jobMatch.create({
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

      requiredSkills: analysis.requiredSkills,
      preferredSkills: analysis.preferredSkills,
      seniorityLevel: analysis.seniorityLevel,
      educationRequirement: analysis.educationRequirement,
      domain: analysis.domain,

      whyMatches: analysis.whyMatches,
      strongestMatchingSkills: analysis.strongestMatchingSkills,
      missingSkills: analysis.missingSkills,
      experienceGap: analysis.experienceGap,
      concerns: analysis.concerns,
      applicationRecommendation: analysis.applicationRecommendation,
      interviewTopics: analysis.interviewTopicsToPrepare,
      factLabels: analysis.factLabels,

      remoteStatus: analysis.eligibility.remoteStatus,
      indiaEligible: triToDb(analysis.eligibility.indiaEligible),
      worldwideRemote: triToDb(analysis.eligibility.worldwideRemote),
      locationRestriction: analysis.eligibility.locationRestriction,
      visaRequired: triToDb(analysis.eligibility.visaRequired),
      relocationRequired: triToDb(analysis.eligibility.relocationRequired),
      eligibilityConfidence: analysis.eligibility.eligibilityConfidence,
      eligibilityEvidence: analysis.eligibility.eligibilityEvidence,
      salaryEvidence: analysis.eligibility.salaryEvidence,
    },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: { matchScore: overallScore, status: "reviewed" },
  });

  return { overallScore, priority };
}
