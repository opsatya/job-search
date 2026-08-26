import type { Job } from "../../src/types/job";

describe("Job type", () => {
  it("accepts a minimal valid job shape", () => {
    const job: Job = {
      id: "job_1",
      source: "greenhouse",
      company: "Acme",
      title: "Software Engineer",
      description: "Build things.",
      url: "https://example.com/job/1",
      locations: ["Remote"],
      discoveredAt: new Date(),
      status: "new",
    };
    expect(job.status).toBe("new");
  });
});
