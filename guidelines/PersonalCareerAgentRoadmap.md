# Personal Career Agent - Top to Bottom Roadmap

## 1) Product Goal
Build a secure mobile-first career assistant that:
- Connects to Gmail/Outlook with explicit OAuth consent.
- Reads job-related emails and tracks opportunities.
- Stores a master resume and creates job-specific tailored resumes.
- Scores role fit and interview probability.
- Suggests or sends approved replies for selected events.
- Aggregates real jobs from trusted sources and company career pages.

## 2) Compliance and Safety Guardrails
- Never store raw email passwords. Use OAuth only.
- Encrypt tokens and resume files at rest.
- Do not auto-send mail without user approval toggle and audit log.
- Respect robots.txt and Terms of Service for each job source.
- Add scam detection before surfacing a job as verified.

## 3) System Architecture
- Mobile/Web Frontend (current React app): dashboard, jobs, resume optimizer, email logs.
- API Gateway: auth, profile, jobs, resume, email workflows.
- Job Intelligence Service: ingestion, dedupe, scam checks, matching score.
- Resume Service: parse resume, keyword extraction, tailored generation.
- Email Service: webhook polling, classification, draft replies, send-on-approval.
- Scheduler/Workers: periodic job crawling, email sync, follow-up reminders.
- Database: users, oauth_tokens, resumes, jobs, job_matches, email_events, auto_reply_rules.

## 4) Recommended Tech Stack
- Frontend: React + TypeScript (existing), React Query, Zustand.
- Backend: FastAPI (Python) or NestJS (Node). Pick one and keep all services in same stack initially.
- AI: Gemini API for job-match reasoning and resume tailoring.
- DB: PostgreSQL + Redis queues.
- Object Storage: S3-compatible bucket for resumes and generated PDFs.
- Workers: Celery/RQ (Python) or BullMQ (Node).

## 5) API Contracts (MVP)
- POST /auth/google/start
- GET /auth/google/callback
- GET /emails/events
- POST /emails/reply/draft
- POST /emails/reply/send
- POST /resumes/master/upload
- POST /resumes/tailor
- GET /jobs/feed
- GET /jobs/:id/match
- POST /jobs/:id/apply

## 6) Matching Logic (MVP)
Inputs:
- Skills overlap
- Experience overlap
- Must-have keyword presence
- Location/remote fit
- Seniority fit

Output:
- matchPercentage (0-100)
- interviewChance (0-100)
- missingKeywords list
- tailoredResumeRecommendations list

## 7) Rollout Plan
Week 1-2:
- OAuth login, user profile, encrypted token storage.
- Master resume upload and parsing.

Week 3-4:
- Email event ingestion and classification (job, interview, rejection, noise).
- Email logs UI integration.

Week 5-6:
- Job feed ingestion (start with APIs + partner-friendly sources).
- Verification and scam heuristics.

Week 7-8:
- Resume tailoring endpoint and PDF export.
- Job details page with "Use Tailored Resume" and "Next Step: Apply".

Week 9-10:
- Smart reply drafts and approval workflow.
- Notification engine for high-match opportunities.

Week 11-12:
- Observability, security hardening, and production release checks.

## 8) What Is Already Added In This Frontend
- Shared typed models for jobs, resume insights, and email activities.
- Unified mock data source used across Dashboard, Jobs, AI Resume, and Email Logs.
- Job cards now show source + interview chance + resume/apply actions.
- Email logs now include explicit approval gate for auto-replies.

## 9) Next Implementation Task (Recommended)
Implement backend `OAuth + Email Sync` first, because every major feature depends on trusted mailbox signals.
