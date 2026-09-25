import { prisma } from "../../src/db/client";
import {
  loadCandidateProfileFromFile,
  seedCandidateProfile,
  getCandidateProfile,
} from "../../src/db/candidate-profile";

describe("candidate profile", () => {
  afterAll(async () => {
    await prisma.candidateProfile.deleteMany();
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
