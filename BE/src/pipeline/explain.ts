import { deriveSkillLists, normalizeSkill } from "./scoring";
import type { JobFacts, MatchExplanation, PriorityTier, Tri } from "./scoring";
import type { CandidateProfile } from "../types/candidate";
import type { Job } from "../types/job";

function triLabel(value: Tri): string {
  return value === "UNKNOWN" ? "UNKNOWN" : value ? "yes" : "no";
}

function recommend(
  facts: JobFacts,
  priority: PriorityTier,
): MatchExplanation["applicationRecommendation"] {
  const { indiaEligible, worldwideRemote } = facts.eligibility;
  if (indiaEligible === false && worldwideRemote !== true) return "skip";
  if (priority === "P3") return "skip";
  if (indiaEligible === "UNKNOWN" && worldwideRemote !== true) return "needs_review";
  if (priority === "P0") return "strong_apply";
  if (priority === "P1") return "apply";
  return "consider";
}

// Every sentence here is derived from extracted facts, the profile, or the
// computed score — never from model-written prose (spec §6.2).
export function explainMatch(
  candidate: CandidateProfile,
  job: Job,
  facts: JobFacts,
  priority: PriorityTier,
): MatchExplanation {
  const { strongestMatchingSkills, missingSkills } = deriveSkillLists(candidate, facts);
  const matchedKeys = new Set(strongestMatchingSkills.map(normalizeSkill));
  const requiredMatched = facts.requiredSkills.filter((s) => matchedKeys.has(normalizeSkill(s)));

  const years = candidate.experience.months / 12;
  const min = facts.experienceRequirementYears?.min;
  const experienceGap =
    min !== undefined && min !== null && min > years
      ? `Asks ${min}+ yrs; you have ${years.toFixed(1)}`
      : undefined;

  const parts: string[] = [];
  parts.push(
    facts.requiredSkills.length > 0
      ? `Matches ${requiredMatched.length} of ${facts.requiredSkills.length} required skills` +
          (requiredMatched.length > 0 ? ` (${requiredMatched.join(", ")}).` : ".")
      : "No required skills stated.",
  );
  if (missingSkills.length > 0) parts.push(`Missing: ${missingSkills.join(", ")}.`);
  parts.push(
    min !== undefined && min !== null
      ? `Experience: asks ${min}+ yrs; you have ${years.toFixed(1)}.`
      : "Experience: not stated.",
  );
  parts.push(
    `India eligibility: ${triLabel(facts.eligibility.indiaEligible)} — evidence: '${facts.eligibility.eligibilityEvidence}'.`,
  );

  const concerns = [...facts.concerns];
  if (experienceGap) {
    concerns.push(
      `Experience gap: ${experienceGap.charAt(0).toLowerCase()}${experienceGap.slice(1)}`,
    );
  }
  if (job.salaryMin === undefined && job.salaryMax === undefined) {
    concerns.push("Salary not disclosed");
  }

  return {
    whyMatches: parts.join(" "),
    strongestMatchingSkills,
    missingSkills,
    experienceGap,
    concerns,
    applicationRecommendation: recommend(facts, priority),
    interviewTopicsToPrepare: facts.requiredSkills.slice(0, 5),
  };
}
