export interface CandidateProfile {
  name: string;
  location: string;
  education: {
    degree: string;
    university: string;
    status: "completed" | "in_progress";
    cgpa?: number;
  };
  experience: {
    months: number;
    production: boolean;
  };
  primaryRoles: string[];
  secondaryRoles: string[];
  skills: {
    languages: string[];
    backend: string[];
    frontend: string[];
    databases: string[];
    cloudDevOps: string[];
    architecture: string[];
  };
  preferences: {
    remotePreferred: boolean;
    locations: string[];
    internationalRemote: boolean;
    salaryFloorLpa: number;
    salaryTargetLpa: number;
    salaryPreferredLpa: number;
    startupFriendly: boolean;
    productCompanyPreferred: boolean;
  };
}
