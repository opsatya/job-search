import { normalizeSkill, SKILL_ALIASES } from "./scoring";
import type { JobAnalysisResult } from "./scoring";
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

export type GroundingResult =
  { ok: true; analysis: JobAnalysisResult } | { ok: false; reason: string };

// Enforces the anti-hallucination rule in code: an extracted skill the posting
// never mentions isn't a fact. A real run had llama3.1 copy the candidate's
// own skills into an ML job's requiredSkills (0/11 in the posting), which the
// deterministic scorer then ranked P1 — so a mostly-ungrounded extraction is
// rejected outright (and retried), and isolated misses are dropped.
export function groundAnalysis(job: Job, analysis: JobAnalysisResult): GroundingResult {
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
  return {
    ok: true,
    analysis: {
      ...analysis,
      requiredSkills: analysis.requiredSkills.filter(isGrounded),
      preferredSkills: analysis.preferredSkills.filter(isGrounded),
      concerns:
        ungrounded.length > 0
          ? [
              ...analysis.concerns,
              `Dropped extracted skills not found in the job posting: ${ungrounded.join(", ")}`,
            ]
          : analysis.concerns,
    },
  };
}
