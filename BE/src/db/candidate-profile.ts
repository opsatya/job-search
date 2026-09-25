import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { prisma } from "./client";
import type { CandidateProfile } from "../types/candidate";

const PROFILE_PATH = join(__dirname, "../../profile/candidate.yaml");

export function loadCandidateProfileFromFile(): CandidateProfile {
  const raw = readFileSync(PROFILE_PATH, "utf-8");
  return load(raw) as CandidateProfile;
}

export async function seedCandidateProfile(): Promise<void> {
  const profile = loadCandidateProfileFromFile();
  const existing = await prisma.candidateProfile.findFirst();
  if (existing) {
    await prisma.candidateProfile.update({
      where: { id: existing.id },
      data: { data: profile as any },
    });
    return;
  }
  await prisma.candidateProfile.create({ data: { data: profile as any } });
}

export async function getCandidateProfile(): Promise<CandidateProfile> {
  const record = await prisma.candidateProfile.findFirst();
  if (!record) {
    throw new Error("Candidate profile not seeded — run seedCandidateProfile() first.");
  }
  return record.data as unknown as CandidateProfile;
}
