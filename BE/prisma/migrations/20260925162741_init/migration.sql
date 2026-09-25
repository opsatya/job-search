-- CreateTable
CREATE TABLE "candidate_profile" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceJobId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "companyUrl" TEXT,
    "locations" TEXT[],
    "remote" BOOLEAN,
    "employmentType" TEXT,
    "experienceMin" INTEGER,
    "experienceMax" INTEGER,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT,
    "technologies" TEXT[],
    "postedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "matchScore" DOUBLE PRECISION,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_matches" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "skillMatch" DOUBLE PRECISION NOT NULL,
    "experienceMatch" DOUBLE PRECISION NOT NULL,
    "locationMatch" DOUBLE PRECISION NOT NULL,
    "seniorityMatch" DOUBLE PRECISION NOT NULL,
    "educationMatch" DOUBLE PRECISION NOT NULL,
    "salaryMatch" DOUBLE PRECISION NOT NULL,
    "domainMatch" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "priority" TEXT NOT NULL,
    "requiredSkills" TEXT[],
    "preferredSkills" TEXT[],
    "seniorityLevel" TEXT NOT NULL,
    "educationRequirement" TEXT,
    "domain" TEXT,
    "whyMatches" TEXT NOT NULL,
    "strongestMatchingSkills" TEXT[],
    "missingSkills" TEXT[],
    "experienceGap" TEXT,
    "concerns" TEXT[],
    "applicationRecommendation" TEXT NOT NULL,
    "interviewTopics" TEXT[],
    "factLabels" JSONB NOT NULL,
    "remoteStatus" TEXT NOT NULL,
    "indiaEligible" BOOLEAN,
    "worldwideRemote" BOOLEAN,
    "locationRestriction" TEXT,
    "visaRequired" BOOLEAN,
    "relocationRequired" BOOLEAN,
    "eligibilityConfidence" TEXT NOT NULL,
    "eligibilityEvidence" TEXT NOT NULL,
    "salaryEvidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourcesChecked" INTEGER NOT NULL,
    "jobsFound" INTEGER NOT NULL,
    "jobsNew" INTEGER NOT NULL,
    "jobsFiltered" INTEGER NOT NULL,
    "jobsAnalyzed" INTEGER NOT NULL,
    "strongMatches" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_dedupeKey_key" ON "jobs"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "agent_runs_runId_key" ON "agent_runs"("runId");

-- AddForeignKey
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
