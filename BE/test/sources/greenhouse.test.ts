import { GreenhouseSource } from "../../src/sources/greenhouse";

const SAMPLE_RESPONSE = {
  jobs: [
    {
      id: 12345,
      title: "Software Engineer, Backend",
      absolute_url: "https://boards.greenhouse.io/acme/jobs/12345",
      location: { name: "Remote - India" },
      content: "<p>We build things with Node.js.</p>",
      updated_at: "2026-08-20T10:00:00Z",
    },
  ],
};

describe("GreenhouseSource", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }) as unknown as typeof fetch;
  });

  it("fetches and maps jobs from a board token", async () => {
    const source = new GreenhouseSource(["acme"]);
    const jobs = await source.search({ roles: ["Software Engineer"], locations: ["Remote"] });

    expect(fetch).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true",
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "greenhouse",
      sourceJobId: "12345",
      title: "Software Engineer, Backend",
      company: "acme",
      url: "https://boards.greenhouse.io/acme/jobs/12345",
      locationText: "Remote - India",
    });
  });

  it("continues past a board that fails to fetch", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => SAMPLE_RESPONSE });

    const source = new GreenhouseSource(["missing-co", "acme"]);
    const jobs = await source.search({ roles: [], locations: [] });

    expect(jobs).toHaveLength(1);
  });
});
