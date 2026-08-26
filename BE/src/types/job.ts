export type JobStatus =
  | "new"
  | "reviewed"
  | "interesting"
  | "applied"
  | "rejected"
  | "archived";

export interface Job {
  id: string;
  source: string;
  sourceJobId?: string;
  company: string;
  title: string;
  description: string;
  url: string;
  companyUrl?: string;
  locations: string[];
  remote?: boolean;
  employmentType?: string;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  technologies?: string[];
  postedAt?: Date;
  discoveredAt: Date;
  status: JobStatus;
  matchScore?: number;
}
