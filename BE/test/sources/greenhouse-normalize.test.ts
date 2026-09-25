import { normalizeGreenhouseJob } from "../../src/sources/greenhouse/normalize";
import type { RawJob } from "../../src/sources/types";

describe("normalizeGreenhouseJob", () => {
  it("maps a raw Greenhouse job to the canonical Job shape", () => {
    const raw: RawJob = {
      source: "greenhouse",
      sourceJobId: "12345",
      title: "Software Engineer, Backend",
      company: "acme",
      url: "https://boards.greenhouse.io/acme/jobs/12345",
      locationText: "Remote - India",
      description: "<p>We build things with Node.js.</p>",
      postedAt: "2026-08-20T10:00:00Z",
    };

    const job = normalizeGreenhouseJob(raw);

    expect(job.source).toBe("greenhouse");
    expect(job.sourceJobId).toBe("12345");
    expect(job.company).toBe("acme");
    expect(job.title).toBe("Software Engineer, Backend");
    expect(job.url).toBe(raw.url);
    expect(job.locations).toEqual(["Remote - India"]);
    expect(job.remote).toBe(true);
    expect(job.description).toBe("We build things with Node.js.");
    expect(job.postedAt).toEqual(new Date("2026-08-20T10:00:00Z"));
    expect(job.status).toBe("new");
    expect(job.id).toEqual(expect.any(String));
    expect(job.discoveredAt).toEqual(expect.any(Date));
  });

  it("does not mark a job remote when the location has no remote indicator", () => {
    const raw: RawJob = {
      source: "greenhouse",
      sourceJobId: "999",
      title: "Software Engineer",
      company: "acme",
      url: "https://boards.greenhouse.io/acme/jobs/999",
      locationText: "Bengaluru, India",
      description: "<p>Office role.</p>",
    };

    const job = normalizeGreenhouseJob(raw);
    expect(job.remote).toBe(false);
  });
});
