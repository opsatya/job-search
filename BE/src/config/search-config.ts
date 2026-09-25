export const SEARCH_CONFIG = {
  roles: [
    "Junior Full Stack Developer",
    "Software Engineer",
    "Backend Engineer",
    "Node.js Developer",
    "React Developer",
    "TypeScript Developer",
  ],
  locations: ["Remote India", "Pune", "Mumbai", "Bengaluru", "Hyderabad", "Delhi NCR"],
  minimumSalaryLpa: 5,
  targetSalaryLpa: 6,
  preferredSalaryLpa: 8,
  maxExperienceYears: 2,
  startupFriendly: true,
  productCompanyPreferred: true,
  // Greenhouse board tokens to search — one per company career page on Greenhouse.
  // Public, no auth required: https://boards-api.greenhouse.io/v1/boards/<token>/jobs
  greenhouseBoardTokens: ["gitlab", "figma", "airtable"],
} as const;
