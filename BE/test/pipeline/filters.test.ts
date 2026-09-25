import { passesHardFilters } from "../../src/pipeline/filters";
import type { Job } from "../../src/types/job";

function makeJob(title: string): Job {
  return {
    id: "x",
    source: "greenhouse",
    company: "Acme",
    title,
    description: "desc",
    url: "https://example.com/1",
    locations: ["Remote"],
    discoveredAt: new Date(),
    status: "new",
  };
}

describe("passesHardFilters", () => {
  it.each([
    "Senior Software Engineer",
    "Staff Engineer",
    "Engineering Manager",
    "Director of Engineering",
  ])("rejects seniority-excluded title: %s", (title) => {
    expect(passesHardFilters(makeJob(title))).toBe(false);
  });

  it.each(["Data Scientist", "QA Engineer", "DevOps Engineer", "Product Manager", "UX Designer"])(
    "rejects clearly unrelated role: %s",
    (title) => {
      expect(passesHardFilters(makeJob(title))).toBe(false);
    },
  );

  it.each([
    "Junior Software Engineer",
    "Software Engineer",
    "Full Stack Developer",
    "Backend Engineer",
    "Node.js Developer",
    "React Developer",
  ])("keeps relevant title: %s", (title) => {
    expect(passesHardFilters(makeJob(title))).toBe(true);
  });

  it("rejects a title that matches neither the keep nor reject list", () => {
    expect(passesHardFilters(makeJob("Marketing Coordinator"))).toBe(false);
  });
});
