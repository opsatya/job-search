import { normalizeSkill, SKILL_ALIASES } from "./scoring";
import type { JobFacts } from "./scoring";
import type { Job } from "../types/job";

function compact(text: string): string {
  return text.toLowerCase().replace(/[\s._-]/g, "");
}

// Short aliases ("ts", "go") would match almost any text, so only longer
// alternate spellings are searched for in the posting.
const MIN_ALIAS_LENGTH = 4;

function appearsIn(postingText: string, skill: string): boolean {
  const canonical = normalizeSkill(skill);
  const spellings = [
    compact(skill),
    canonical,
    ...Object.entries(SKILL_ALIASES)
      .filter(([alias, target]) => target === canonical && alias.length >= MIN_ALIAS_LENGTH)
      .map(([alias]) => alias),
  ];
  return spellings.some((spelling) => postingText.includes(spelling));
}

// Only terms that literally establish eligibility — never inferences such as
// "APAC" ⇒ India, which would collapse UNKNOWN into true.
const INDIA_TERMS =
  /\b(india|indian|bangalore|bengaluru|pune|hyderabad|mumbai|delhi|gurgaon|gurugram|noida|chennai|kolkata)\b/i;
const WORLDWIDE_TERMS = /\b(worldwide|anywhere|global|globally|any country|all countries)\b/i;

// The model's own evidence snippet plus the source's structured location
// field are what can support a `true` claim. The full description is not used:
// boilerplate like "collaborate from anywhere in the world" would "support"
// worldwide eligibility for a US-only role (seen on real Figma postings).
function groundEligibility(
  job: Job,
  eligibility: JobFacts["eligibility"],
): { eligibility: JobFacts["eligibility"]; downgraded: string[] } {
  const postingText = compact(`${job.title}\n${job.locations.join("\n")}\n${job.description}`);
  const evidenceIsQuote =
    eligibility.eligibilityEvidence.trim().length > 0 &&
    postingText.includes(compact(eligibility.eligibilityEvidence));
  if (
    !evidenceIsQuote &&
    (eligibility.indiaEligible === true || eligibility.worldwideRemote === true)
  ) {
    return {
      eligibility: {
        ...eligibility,
        indiaEligible: eligibility.indiaEligible === true ? "UNKNOWN" : eligibility.indiaEligible,
        worldwideRemote:
          eligibility.worldwideRemote === true ? "UNKNOWN" : eligibility.worldwideRemote,
      },
      downgraded: ["evidence-not-quoted"],
    };
  }
  const support = `${eligibility.eligibilityEvidence}\n${job.locations.join("\n")}`;
  const grounded = { ...eligibility };
  const downgraded: string[] = [];
  if (grounded.indiaEligible === true && !INDIA_TERMS.test(support)) {
    grounded.indiaEligible = "UNKNOWN";
    downgraded.push("indiaEligible");
  }
  if (grounded.worldwideRemote === true && !WORLDWIDE_TERMS.test(support)) {
    grounded.worldwideRemote = "UNKNOWN";
    downgraded.push("worldwideRemote");
  }
  return { eligibility: grounded, downgraded };
}

export type GroundingResult = { ok: true; analysis: JobFacts } | { ok: false; reason: string };

// Enforces the anti-hallucination rule in code: an extracted skill the posting
// never mentions isn't a fact. A real run had llama3.1 copy the candidate's
// own skills into an ML job's requiredSkills (0/11 in the posting), which the
// deterministic scorer then ranked P1 — so a mostly-ungrounded extraction is
// rejected outright (and retried), and isolated misses are dropped.
export { groundEligibility, INDIA_TERMS, WORLDWIDE_TERMS };

export function postingMentionsSkill(postingText: string, skill: string): boolean {
  return appearsIn(compact(postingText), skill);
}

export function groundAnalysis(job: Job, analysis: JobFacts): GroundingResult {
  const postingText = compact(`${job.title}\n${job.description}`);
  const extracted = [...analysis.requiredSkills, ...analysis.preferredSkills];
  const ungrounded = extracted.filter((skill) => !appearsIn(postingText, skill));

  if (extracted.length >= 2 && ungrounded.length * 2 > extracted.length) {
    return {
      ok: false,
      reason: `Extraction not grounded in the posting: ${ungrounded.length} of ${extracted.length} extracted skills are not in the job description`,
    };
  }

  const isGrounded = (skill: string) => !ungrounded.includes(skill);
  const { eligibility, downgraded } = groundEligibility(job, analysis.eligibility);
  const concerns = [...analysis.concerns];
  if (ungrounded.length > 0) {
    concerns.push(
      `Dropped extracted skills not found in the job posting: ${ungrounded.join(", ")}`,
    );
  }
  if (downgraded.includes("evidence-not-quoted")) {
    concerns.push(
      "Eligibility evidence is not a quote from the posting; true claims set to UNKNOWN",
    );
  } else if (downgraded.length > 0) {
    concerns.push(
      `Eligibility claims not supported by the posting's evidence or locations, set to UNKNOWN: ${downgraded.join(", ")}`,
    );
  }
  return {
    ok: true,
    analysis: {
      ...analysis,
      requiredSkills: analysis.requiredSkills.filter(isGrounded),
      preferredSkills: analysis.preferredSkills.filter(isGrounded),
      eligibility,
      concerns,
    },
  };
}
