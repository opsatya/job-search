import type { CandidateProfile } from "../types/candidate";
import type { Job } from "../types/job";

export type Tri = boolean | "UNKNOWN";

export interface EligibilityFacts {
  remoteStatus: "remote" | "hybrid" | "onsite" | "unclear";
  indiaEligible: Tri;
  worldwideRemote: Tri;
  locationRestriction?: string;
  visaRequired: Tri;
  relocationRequired: Tri;
  eligibilityConfidence: "high" | "medium" | "low";
  eligibilityEvidence: string;
  salaryEvidence?: string;
}

export interface JobAnalysisResult {
  requiredSkills: string[];
  preferredSkills: string[];
  experienceRequirementYears: { min?: number; max?: number };
  seniorityLevel: "junior" | "mid" | "senior" | "unclear";
  educationRequirement?: string;
  domain?: string;
  eligibility: EligibilityFacts;

  whyMatches: string;
  strongestMatchingSkills: string[];
  missingSkills: string[];
  experienceGap?: string;
  concerns: string[];
  applicationRecommendation: "strong_apply" | "apply" | "consider" | "needs_review" | "skip";
  interviewTopicsToPrepare: string[];
  factLabels: Record<string, "FACT" | "INFERENCE" | "UNKNOWN">;
}

export interface CategoryScores {
  skillMatch: number;
  experienceMatch: number;
  locationMatch: number;
  seniorityMatch: number;
  educationMatch: number;
  salaryMatch: number;
  domainMatch: number;
}

function flattenCandidateSkills(candidate: CandidateProfile): Set<string> {
  const all = [
    ...candidate.skills.languages,
    ...candidate.skills.backend,
    ...candidate.skills.frontend,
    ...candidate.skills.databases,
    ...candidate.skills.cloudDevOps,
    ...candidate.skills.architecture,
  ];
  return new Set(all.map((s) => s.toLowerCase()));
}

function matchRatio(required: string[], candidateSkills: Set<string>): number {
  if (required.length === 0) return 1;
  const matched = required.filter((skill) => candidateSkills.has(skill.toLowerCase()));
  return matched.length / required.length;
}

const REQUIRED_SKILL_WEIGHT = 22;
const PREFERRED_SKILL_WEIGHT = 8;

export function scoreSkillMatch(candidate: CandidateProfile, facts: JobAnalysisResult): number {
  const candidateSkills = flattenCandidateSkills(candidate);
  const requiredRatio = matchRatio(facts.requiredSkills, candidateSkills);
  const preferredRatio = matchRatio(facts.preferredSkills, candidateSkills);
  return Math.round(requiredRatio * REQUIRED_SKILL_WEIGHT + preferredRatio * PREFERRED_SKILL_WEIGHT);
}

const EXPERIENCE_GAP_YEARS_FOR_ZERO = 2;

export function scoreExperienceMatch(candidate: CandidateProfile, facts: JobAnalysisResult): number {
  const min = facts.experienceRequirementYears.min;
  if (min === undefined) return 20;
  const candidateYears = candidate.experience.months / 12;
  const gap = Math.max(0, min - candidateYears);
  const fraction = Math.max(0, 1 - gap / EXPERIENCE_GAP_YEARS_FOR_ZERO);
  return Math.round(20 * fraction);
}

export function scoreLocationMatch(
  candidate: CandidateProfile,
  job: Job,
  facts: JobAnalysisResult,
): number {
  const { eligibility } = facts;

  if (eligibility.remoteStatus === "remote") {
    if (eligibility.indiaEligible === true || eligibility.worldwideRemote === true) {
      return 20;
    }
    if (eligibility.indiaEligible === "UNKNOWN" && eligibility.worldwideRemote === "UNKNOWN") {
      return 10;
    }
    return 2;
  }

  const preferredCity = candidate.preferences.locations.some((city) =>
    job.locations.some((loc) => loc.toLowerCase().includes(city.toLowerCase())),
  );
  return preferredCity ? 18 : 5;
}

export function scoreSeniorityMatch(facts: JobAnalysisResult): number {
  switch (facts.seniorityLevel) {
    case "junior":
      return 15;
    case "unclear":
      return 10;
    case "mid":
      return 6;
    case "senior":
      return 0;
  }
}

const RECOGNIZED_EDUCATION_TERMS = [
  "bachelor",
  "master",
  "mca",
  "b.tech",
  "computer science",
  "engineering",
  "degree",
];

export function scoreEducationMatch(facts: JobAnalysisResult): number {
  if (!facts.educationRequirement) return 5;
  const requirement = facts.educationRequirement.toLowerCase();
  const recognized = RECOGNIZED_EDUCATION_TERMS.some((term) => requirement.includes(term));
  return recognized ? 5 : 2;
}

export function scoreSalaryMatch(candidate: CandidateProfile, job: Job): number {
  const salary = job.salaryMax ?? job.salaryMin;
  if (salary === undefined) return 3;

  const { salaryFloorLpa, salaryTargetLpa, salaryPreferredLpa } = candidate.preferences;
  if (salary >= salaryPreferredLpa) return 5;
  if (salary >= salaryTargetLpa) return 4;
  if (salary >= salaryFloorLpa) return 3;
  return 1;
}

const POSITIVE_DOMAINS = [
  "saas",
  "b2b saas",
  "ai",
  "devtools",
  "developer platforms",
  "fintech",
  "healthtech",
  "e-commerce",
  "automation",
  "hrtech",
  "productivity",
];

export function scoreDomainMatch(facts: JobAnalysisResult): number {
  if (!facts.domain) return 3;
  const recognized = POSITIVE_DOMAINS.includes(facts.domain.toLowerCase());
  return recognized ? 5 : 2;
}

export function scoreJob(candidate: CandidateProfile, job: Job, facts: JobAnalysisResult): CategoryScores {
  return {
    skillMatch: scoreSkillMatch(candidate, facts),
    experienceMatch: scoreExperienceMatch(candidate, facts),
    locationMatch: scoreLocationMatch(candidate, job, facts),
    seniorityMatch: scoreSeniorityMatch(facts),
    educationMatch: scoreEducationMatch(facts),
    salaryMatch: scoreSalaryMatch(candidate, job),
    domainMatch: scoreDomainMatch(facts),
  };
}

export function calculateOverallScore(scores: CategoryScores): number {
  return (
    scores.skillMatch +
    scores.experienceMatch +
    scores.locationMatch +
    scores.seniorityMatch +
    scores.educationMatch +
    scores.salaryMatch +
    scores.domainMatch
  );
}

export type PriorityTier = "P0" | "P1" | "P2" | "P3";

export function categorize(score: number): PriorityTier {
  if (score >= 90) return "P0";
  if (score >= 80) return "P1";
  if (score >= 65) return "P2";
  return "P3";
}
