development, backend engineering, databases, cloud technologies, and system design.

Worked on academic and personal projects involving React, TypeScript, Node.js, Python, PostgreSQL, MongoDB, REST APIs, and cloud technologies. Participated in hackathons and collaborative software development projects.￼… more

 PERN, Amazon Web Services (AWS) and +3 skills

We are now moving from the initial job-search prototype into an aggressive real-world job discovery and tracking system.

The goal is NOT to simply collect as many job listings as possible.

The goal is to discover, verify, rank, and track software engineering opportunities where the candidate has a realistic chance of being hired.

## Candidate Profile

Candidate: Satyajeet Singh

Education:

* MCA, Savitribai Phule Pune University
* Completed
* CGPA: ~7.91/10

Professional Experience:

* ~10 months production experience as a Full-Stack Developer
* Production SaaS environment
* Experience across frontend, backend, databases, cloud, APIs, authentication, debugging, and deployment

Primary stack:

* TypeScript
* JavaScript
* React
* Node.js
* Fastify
* PostgreSQL
* Prisma
* Redis
* REST APIs
* AWS

Additional:

* MongoDB
* Docker
* Linux
* Nginx
* React Native
* Python
* Java
* Git/GitHub
* BullMQ
* Socket.IO
* Redux Toolkit
* Tailwind CSS
* CI/CD
* Monorepos

Target roles:

* Software Engineer
* Software Engineer I
* Junior Software Engineer
* Full Stack Developer
* Full Stack Engineer
* Backend Engineer
* Backend Developer
* SDE-1
* Associate Software Engineer
* Node.js Developer
* TypeScript Developer
* React Developer

Target experience:

* 0–2 years
* New graduate / early-career
* Junior
* Entry-level
* Software Engineer I

Compensation preference:

* Preferred: ₹6–8 LPA+
* Still consider lower compensation if the company, role, technology, learning opportunity, or international exposure is unusually strong.
* Do NOT use salary as a hard discovery filter.

Geography:

Tier 1:

* Remote India
* Worldwide remote
* Remote roles explicitly allowing India

Tier 2:

* Pune
* Bangalore
* Hyderabad
* Mumbai
* Delhi NCR / Gurgaon / Noida
* Other Indian technology hubs

Tier 3:

* International companies hiring contractors/employees from India
* UK
* Europe
* Canada
* Singapore
* Australia
* Other countries where India-based remote employment is explicitly possible

Do NOT assume that a job marked "Remote" is available from India.

Determine the actual geographic eligibility.

## Search Strategy

Search across:

1. Official company career pages
2. Greenhouse
3. Lever
4. Workable
5. Other public ATS platforms
6. Wellfound
7. Legitimate remote-job boards
8. Public job-search pages
9. Company LinkedIn/job pages when legitimately accessible
10. Other reliable sources

Prioritize official company job pages and ATS sources over aggregators.

Do not depend on LinkedIn scraping.

Do not bypass authentication, CAPTCHAs, anti-bot systems, paywalls, or access controls.

## Search Categories

Run separate searches for:

A. Indian startups/product companies
B. Indian remote jobs
C. International companies hiring from India
D. Worldwide remote jobs
E. UK/EU companies with India-compatible remote/contract arrangements
F. Early-stage startups
G. SaaS companies
H. AI companies
I. FinTech
J. DevTools
K. E-commerce
L. HRTech
M. HealthTech
N. Developer platforms

## Hard Filters

Reject or flag jobs that clearly require:

* 3+ years experience unless the role explicitly welcomes exceptional junior candidates
* Senior/Staff/Lead/Principal level
* Mandatory location outside India with no India eligibility
* Mandatory visa/work authorization that the candidate does not have
* Mandatory relocation
* Internship-only roles
* Non-software roles
* Roles with completely unrelated technology requirements

Do not reject a job merely because one technology is missing if the core stack is strongly aligned.

Example:
If a role asks for TypeScript + React + Node.js + PostgreSQL + AWS + one additional framework, consider it relevant.

## Remote Eligibility

Create explicit fields:

* remote_status
* eligible_country
* india_eligible
* worldwide_remote
* location_restriction
* visa_required
* relocation_required
* eligibility_confidence
* eligibility_evidence

Never infer India eligibility merely because a job says "Remote."

If eligibility cannot be verified:

eligibility_status = "UNKNOWN"

Do not convert UNKNOWN into TRUE.

## Job Extraction

For every job collect:

* company
* role
* job_url
* official_company_url
* source
* source_url
* date_discovered
* date_posted
* employment_type
* experience_requirement
* location
* remote_status
* country_eligibility
* salary
* currency
* salary_period
* required_skills
* preferred_skills
* responsibilities
* education_requirement
* visa_requirement
* relocation_requirement
* application_url

## Candidate Matching

Calculate separate scores:

1. Skill match
2. Experience match
3. Seniority match
4. Location eligibility
5. Education match
6. Compensation match
7. Domain match

Do NOT produce an unexplained AI score.

Use deterministic scoring in TypeScript.

LLM analysis may provide structured reasoning but must not replace deterministic scoring.

## LLM Analysis

For each promising job produce:

* why_candidate_matches
* strongest_matching_skills
* missing_skills
* experience_gap
* concerns
* application_recommendation
* interview_topics_to_prepare

The LLM must distinguish:

FACT
INFERENCE
UNKNOWN

Never hallucinate missing requirements.

## Contact Discovery

If publicly available, find:

* recruiter
* hiring manager
* engineering manager
* founder for small startups
* public professional profile
* public company email

Only record contact information supported by a source.

NEVER guess email addresses.

If no contact is found:

contact_person = null
contact_email = null

## Deduplication

The same job may appear on multiple sources.

Deduplicate using:

* normalized company
* normalized role
* canonical job URL
* ATS job ID where available
* similarity of job title + company

Keep source information for duplicate listings.

## Ranking

Create:

* score
* priority
* match_reason
* risk_flags

Priority should be:

P0 = exceptionally strong match
P1 = strong match
P2 = reasonable match
P3 = stretch / needs verification

Do not use salary alone to determine priority.

## Excel Output

Generate:

Satyajeet_Job_Search_<DATE>.xlsx

Sheets:

1. Top Matches
2. All Jobs
3. Companies
4. Contacts
5. Application Tracker
6. Rejected Jobs
7. Search Sources
8. Search Summary

Top Matches columns:

* Priority
* Score
* Company
* Role
* Location
* Remote Eligibility
* Salary
* Experience
* Skill Match
* Experience Match
* Why Match
* Main Gap
* Risk Flags
* Application URL
* Official Company URL
* Contact Person
* Contact Profile
* Contact Email
* Source
* Date Posted
* Date Discovered
* Eligibility Evidence
* Salary Evidence
* Verification Status

Application Tracker:

* Company
* Role
* Application URL
* Applied Date
* Contact Person
* Outreach Sent
* Follow-up Date
* Current Stage
* Interview Date
* Result
* Notes

## Verification

Every job should have:

verification_status:

* VERIFIED
* PARTIALLY_VERIFIED
* UNKNOWN
* EXPIRED

A job should not be marked VERIFIED unless the source supports its important factual fields.

Prefer jobs that are currently active.

Check whether the application page is still accessible.

## Search Volume

Do not stop after finding 10 jobs.

For the first run, aim to discover approximately 100–200 raw opportunities, then filter them down to a high-quality shortlist.

The final shortlist should preferably contain approximately 30–50 genuinely relevant opportunities rather than hundreds of low-quality listings.

## Important Philosophy

We are NOT optimizing for the number of jobs found.

We are optimizing for:

RELEVANCE × ELIGIBILITY × RECENCY × APPLICATION QUALITY

The candidate should be able to open the Excel file and immediately know:

1. Which jobs should I apply to first?
2. Why am I a fit?
3. What is missing?
4. Can I actually work from India?
5. Where do I apply?
6. Who can I contact?
7. When should I follow up?

## Human-in-the-loop

DO NOT automatically submit applications.

DO NOT automatically message recruiters.

DO NOT send emails.

The system should discover, analyze, rank, and prepare the information.

The candidate makes the final application and outreach decision.

## Implementation

Use:

* TypeScript/Node.js for orchestration
* PostgreSQL + Prisma for persistent storage
* Redis/BullMQ if useful for queues
* OpenClaw/LLM only for reasoning/extraction tasks
* Deterministic TypeScript for filtering, deduplication, and scoring
* Python/openpyxl or an equivalent reliable mechanism for XLSX generation if required

Build this incrementally.

First implement:

1. Candidate profile
2. Job source adapters
3. Normalization
4. Deduplication
5. Eligibility filtering
6. Matching
7. Deterministic scoring
8. Excel export

Do NOT implement automatic applications yet.

Before implementing browser automation, determine whether a public API/ATS endpoint exists.

Prefer structured public sources over browser automation.

At the end of the first run, report:

* number of sources searched
* raw jobs found
* duplicates removed
* jobs rejected
* jobs with unknown eligibility
* verified India-eligible jobs
* international opportunities
* final shortlist
* major recurring skill gaps
* most common target technologies
* companies appearing repeatedly
* any source access limitations

Do not claim a source was searched if it was not actually accessible.



What I want you to build with Claude Code

You already had the earlier Job Search Agent idea. I would now make Phase 1 much more serious.

Your pipeline should be:

                    ┌─────────────────────┐
                    │   Your Profile      │
                    │ Resume + Skills     │
                    │ Experience + Goals   │
                    └──────────┬──────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────┐
│                JOB DISCOVERY                       │
│                                                    │
│ Greenhouse │ Lever │ Workable │ Company Careers   │
│ Wellfound  │ Remote boards │ LinkedIn* │ etc.     │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Normalize Jobs  │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │ Deduplicate     │
              └────────┬────────┘
                       ▼
        ┌───────────────────────────────┐
        │ HARD ELIGIBILITY FILTER       │
        │                               │
        │ India eligible?               │
        │ Remote actually remote?       │
        │ Experience <= ~2 yrs?         │
        │ Employment type?              │
        │ Salary if available?          │
        └───────────────┬───────────────┘
                        ▼
             ┌─────────────────────┐
             │ Candidate Matching  │
             │                     │
             │ Skills              │
             │ Experience          │
             │ Education           │
             │ Domain              │
             │ Seniority           │
             └──────────┬──────────┘
                        ▼
               ┌────────────────┐
               │ LLM Analysis   │
               │                │
               │ Why fit?       │
               │ Gaps?          │
               │ Apply?         │
               └────────┬───────┘
                        ▼
              ┌───────────────────┐
              │ Deterministic     │
              │ Score             │
              └─────────┬─────────┘
                        ▼
                 EXCEL / DATABASE
                        │
                        ▼
             YOU REVIEW + APPLY

And LinkedIn should not be the foundation. It can be a discovery source if your tooling can access it legitimately, but don't build a system dependent on scraping logged-in LinkedIn pages.

Your search should have 3 buckets

This is important.

Don't make one giant search.

Bucket A — India

Target:

₹5–8+ LPA

Roles:

Software Engineer
Software Engineer I
Full Stack Developer
Full Stack Engineer
Backend Developer
Backend Engineer
Node.js Developer
TypeScript Developer
React Developer
Junior Software Engineer
SDE-1
Associate Software Engineer

Locations:

Remote India
Pune
Bangalore
Hyderabad
Mumbai
Gurgaon / Delhi NCR
Chennai
Noida
Bucket B — International companies hiring from India

This is probably the most interesting bucket for you.

Not:

“UK Software Engineer Remote”

but:

“UK company + remote + India eligible.”

Same for:

Germany
Netherlands
Ireland
Canada
Singapore
Australia
Europe
Worldwide

The agent needs to distinguish:

❌ Remote — UK only

from:

❌ Remote — Europe only

from:

❌ Remote — Americas

from:

✅ Remote — India

from:

✅ Remote — Worldwide

This distinction is critical.

For example, current remote listings show exactly this problem: some TypeScript jobs are remote but explicitly limited to Europe, while other listings state worldwide eligibility.

Bucket C — High-upside startups

This is where I'd be aggressive.

Don't only search:

“Junior Software Engineer”

Search startups where they may care more about:

“Can this person actually build?”

Your profile can make sense for:

SaaS startups
AI startups
DevTools
FinTech
HealthTech
B2B SaaS
Developer platforms
E-commerce
Automation
HRTech
Productivity tools

You have something useful for startups:

frontend + backend + database + cloud + deployment.

That's a different selling point from someone who only knows React.

And I would NOT make ₹6–8 LPA a hard filter

This is important.

Suppose the agent finds:

Remote India — Software Engineer — ₹5–6 LPA

and the match is extremely strong.

You should see it.

But suppose it finds:

Remote India — Software Engineer — salary undisclosed — excellent match

You should also see it.

And:

International remote — salary €30–40k — India eligible — excellent match

Definitely see it.

Therefore:

Salary should be a ranking factor, not always a discovery filter.
Your Excel should be much better than the previous one

Instead of:

Company	Job	Salary	Link

I want something like:

Priority	Company	Role	Location	Remote Eligibility	Salary	Experience	Match	Why Match	Gaps	Apply URL	Contact	Source	Verified

And then additional columns:

Job information
Company
Role
Job URL
Official company URL
Job posting URL
Source
Date discovered
Date posted
Application deadline if available
Eligibility
Remote?
India eligible?
Worldwide?
Country restriction
Visa required?
Relocation required?
Employment type
Experience requirement
Compensation
Salary
Currency
Salary period
Salary source
Compensation confidence
Matching
Overall match
Skill match
Experience match
Seniority match
Location match
Salary match
Domain match
Application
Application URL
Recruiter
Hiring manager
Recruiter LinkedIn
Contact email
Outreach status
Applied?
Application date
Response
Interview stage
Rejection
Follow-up date
But there's one very important rule
The AI must NOT invent contact information.

This is extremely important.

If it finds:

Jane Smith — Engineering Recruiter

from the company's LinkedIn page:

Fine.

If it finds:

jane@company.com

from a public company page:

Fine.

But if it doesn't find a recruiter:

contact_person = null
contact_email = null

Not an AI-generated guess.

Same with salary.

Same with remote eligibility.

Same with job status.

And I want an evidence column

This is probably the most valuable addition.

For every important claim:

india_eligible = true

store:

eligibility_evidence =
"Job posting states: Remote - India"

Or:

salary_evidence =
"₹6–8 LPA listed on official job page"

Or:

remote_evidence =
"Remote within India"

This prevents the agent from becoming a hallucination machine.

Your scoring should look something like this

Don't let Claude simply say:

“This is an 87% match.”

That's meaningless.

Instead:

Skill Match:             24/30
Experience Match:        18/20
Location Eligibility:    20/20
Seniority Match:         15/15
Education Match:          5/5
Salary/Compensation:      4/5
Domain Match:             3/5
                         -----
Total:                   89/100

Then:

Why: Strong TypeScript/Node/React/PostgreSQL match, 10 months production SaaS experience, India-remote eligible.

Gap: Job asks for 1–2 years; candidate has ~10–12 months.

That's useful.

And here's where Claude Code becomes really useful

Don't just tell Claude:

“Search jobs.”

Give it a candidate profile file.

Something like:

/job-agent
    /profile
        candidate.md
        resume.pdf
        preferences.yaml

    /data
        jobs.json
        companies.json

    /src
        discovery/
        normalization/
        filtering/
        matching/
        scoring/
        contacts/
        export/

    /output
        jobs.xlsx

Your candidate.md can contain:

candidate:
  education:
    - MCA
  experience:
    months: 10
    production: true

  primary_stack:
    - TypeScript
    - JavaScript
    - React
    - Node.js
    - Fastify
    - PostgreSQL
    - Prisma
    - Redis
    - AWS

  secondary:
    - MongoDB
    - Docker
    - Linux
    - Nginx
    - React Native
    - Python
    - Java

  target_roles:
    - Software Engineer
    - Full Stack Developer
    - Backend Engineer
    - SDE-1
    - Software Engineer I

  target_locations:
    india_remote: true
    pune: true
    bangalore: true
    hyderabad: true
    mumbai: true
    international_remote: true

  salary:
    preferred_inr: 600000
    minimum_target_inr: 500000

  experience:
    preferred_max_years: 2

Then Claude's job is to match reality against this profile, rather than repeatedly asking an LLM what jobs might suit you.

I would also make the agent discover companies, not just jobs

This is the next level.

Suppose it finds:

Company X

and Company X has no current opening suitable for you.

The agent can put it into:

Target Companies
Company	Why interesting	Stack	India remote	Careers	Contact	Status

Then you can revisit them.

Because sometimes the best opportunity isn't the job you find today.

It's the company you discover today that opens a role next month.

And your friend's case gives us a useful lesson

Don't look at his resume and conclude:

“His resume got him the job, therefore mine should get me a better one.”

Instead ask:

“What kind of job did his profile match?”

His resume is heavily positioned around:

Java → Spring Boot → REST → MySQL → backend

Your strongest positioning is:

TypeScript → Node/Fastify → React → PostgreSQL → Redis → AWS → production SaaS

So your job agent should search accordingly.

If we send your resume to 500 Java/Spring jobs, the fact that you have a good resume won't help.

If we find 100 genuinely relevant TypeScript/Node/React/Full-Stack/Backend openings and apply intelligently, that's a different game.

One more thing: don't restrict the agent to “remote”

I'd use this priority:

Tier 1

Remote India / Worldwide

Tier 2

Pune / Bangalore / Hyderabad / Mumbai / NCR

Tier 3

International roles that explicitly allow India

Tier 4

International roles where eligibility is unclear

Tier 4 should be flagged:

VERIFY_ELIGIBILITY

—not automatically rejected.

Because sometimes job boards say “UK remote” but the company has an international contractor model; sometimes they don't.

The agent should verify rather than assume.

Can Claude Code actually build this?

Yes.

And honestly, this is a much better use of Claude Code than asking it to manually search websites every morning.

Have Claude Code build the job-search engine.

Use web/search/browser capabilities only where necessary for discovery.

Use APIs / ATS endpoints where available.

Use deterministic TypeScript for:

normalization
deduplication
filtering
scoring
export

Use the LLM for:

interpreting job descriptions
extracting ambiguous requirements
explaining fit
identifying skill gaps
generating outreach drafts

And never let the LLM decide whether a factual field exists when the source doesn't support it.