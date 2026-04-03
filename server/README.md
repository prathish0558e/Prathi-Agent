# Secure Server Plan

## Recommended Stack
Use a hybrid architecture:
- Supabase: Google Auth, PostgreSQL, Storage, Row Level Security
- FastAPI service: Gmail sync, HR email discovery, Gemini calls, notification jobs
- Redis + background workers: scheduled email scans, job crawling, follow-up automation

This gives you:
- Persistent user data even after uninstall/reinstall
- Secure cloud resume storage
- OAuth token handling on the server only
- Hidden AI keys and Google secrets

## Why this is the best fit
- Supabase Auth handles Google sign-in cleanly
- PostgreSQL is strong for job records, profiles, audit logs, and search history
- Supabase Storage fits resume uploads and generated PDFs
- FastAPI keeps Gmail scopes and Gemini API key on the backend only
- Row Level Security helps isolate each user's data securely

## Data Flow
1. User taps Login with Google in app
2. Frontend redirects to backend `/auth/google/start`
3. Backend completes Google OAuth and stores encrypted refresh token
4. Backend loads Gmail job-related emails and stores parsed results in PostgreSQL
5. Background workers crawl verified job sources and company career pages
6. Matching engine compares stored profile + resume + skills against jobs
7. App receives notifications, dashboards, and tailored resume actions

## Security Rules
- Never put Gemini key in frontend code
- Never put Google client secret in frontend code
- Encrypt Gmail refresh tokens at rest
- Store only public config in `VITE_*` variables
- Keep HR auto-mail behind approval or verified automation rules
- Add audit logs for all outbound mail actions
- Hash passwords/PINs with Argon2id, do not store them in plain text
- Use encrypted fields plus blind-index hashes for email, phone, and sensitive mail content
- Use parameterized queries only, never string-built SQL
- Enable Row Level Security on all user-owned tables
- Keep separate keys for encryption, blind indexing, and JWT signing

## Tables to Create
- users
- career_profiles
- resumes
- gmail_tokens
- email_events
- job_sources
- job_opportunities
- job_matches
- outbound_mail_queue
- automation_rules
- notification_events

## Production Hosting
Best practical path:
- Supabase cloud for DB/Auth/Storage
- Railway or Render for FastAPI API + workers
- Upstash Redis or Railway Redis for queues

## First Backend APIs
- GET /auth/google/start
- GET /auth/google/callback
- GET /profile/me
- POST /profile/onboarding
- POST /resume/upload
- GET /emails/sync
- GET /jobs/feed
- POST /jobs/:id/tailor-resume
- POST /jobs/:id/apply
- POST /notifications/register-device

## Injection Defense Rules
- All queries must use placeholders and bound parameters.
- Search, sort, and filter inputs must use allowlists.
- DB roles must not have broad `DROP`, `ALTER`, or unrestricted `SELECT` privileges.
- Outbound APIs must validate URLs and domains before fetching external job content.
