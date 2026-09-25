import type { Job } from "../types/job";

const REJECT_SENIORITY_TERMS = [
  "senior",
  "staff",
  "principal",
  "lead",
  "manager",
  "director",
  "architect",
];

const REJECT_ROLE_TERMS = [
  "data scientist",
  "data analyst",
  "qa",
  "quality assurance",
  "manual tester",
  "devops",
  "product manager",
  "designer",
  "sales",
];

const KEEP_ROLE_TERMS = [
  "junior",
  "entry level",
  "graduate",
  "associate",
  "software engineer",
  "full stack",
  "fullstack",
  "backend",
  "frontend",
  "node.js",
  "node",
  "react",
  "typescript",
];

export function passesHardFilters(job: Job): boolean {
  const title = job.title.toLowerCase();

  if (REJECT_SENIORITY_TERMS.some((term) => title.includes(term))) {
    return false;
  }
  if (REJECT_ROLE_TERMS.some((term) => title.includes(term))) {
    return false;
  }
  return KEEP_ROLE_TERMS.some((term) => title.includes(term));
}
