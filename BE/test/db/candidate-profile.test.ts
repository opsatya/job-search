import { prisma } from "../../src/db/client";
import {
  loadCandidateProfileFromFile,
  seedCandidateProfile,
  getCandidateProfile,
} from "../../src/db/candidate-profile";

// The candidate profile is a singleton table, so these tests can't scope their
// cleanup to a fixture row the way test/db/jobs.test.ts does. Instead, snapshot
// whatever profile row already exists and restore it afterwards — these tests
// share DATABASE_URL with real agent runs, and an unscoped deleteMany() here
// previously wiped the real seeded profile.
let originalProfiles: Awaited<ReturnType<typeof prisma.candidateProfile.findMany>> = [];

describe("candidate profile", () => {
  beforeAll(async () => {
    originalProfiles = await prisma.candidateProfile.findMany();
  });
  afterAll(async () => {
    await prisma.candidateProfile.deleteMany();
    for (const { id, data, createdAt } of originalProfiles) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma's JsonValue read type isn't assignable to InputJsonValue.
      await prisma.candidateProfile.create({ data: { id, data: data as any, createdAt } });
    }
    await prisma.$disconnect();
  });

  it("loads the profile from profile/candidate.yaml", () => {
    const profile = loadCandidateProfileFromFile();
    expect(profile.name).toBe("Satyajeet Singh");
    expect(profile.education.status).toBe("completed");
    expect(profile.experience.months).toBe(10);
  });

  it("seeds and retrieves the candidate profile", async () => {
    await prisma.candidateProfile.deleteMany();
    await seedCandidateProfile();
    const profile = await getCandidateProfile();
    expect(profile.name).toBe("Satyajeet Singh");
  });

  it("does not create duplicate rows when seeded twice", async () => {
    await seedCandidateProfile();
    await seedCandidateProfile();
    const count = await prisma.candidateProfile.count();
    expect(count).toBe(1);
  });
});
