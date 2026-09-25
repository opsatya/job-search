export interface JobSearchParams {
  roles: string[];
  locations: string[];
}

export interface RawJob {
  source: string;
  sourceJobId: string;
  title: string;
  company: string;
  url: string;
  locationText: string;
  description: string;
  postedAt?: string;
}

export interface JobSource {
  name: string;
  search(params: JobSearchParams): Promise<RawJob[]>;
  fetchJob?(url: string): Promise<RawJob>;
  healthCheck?(): Promise<boolean>;
}
