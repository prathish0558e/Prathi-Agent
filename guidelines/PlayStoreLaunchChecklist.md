# Play Store Launch Checklist

## 1. Production Architecture
- Frontend: React + Vite app wrapped as Android app (Capacitor or React Native migration).
- Backend: Node/Express API for job aggregation and automation endpoints.
- Auth + DB: Supabase Auth + Postgres + Storage.
- Queue/Workers: Background workers for job sync and email automation tasks.

## 2. Environment Variables
Frontend (`.env`):
- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Backend (`server/.env`):
- `PORT`
- `ALLOWED_ORIGIN`
- `SUPABASE_SERVICE_ROLE_KEY` (for secure server operations only)
- `SUPABASE_URL`

## 3. Security Requirements
- Keep all secrets in backend only.
- Enable Supabase Row Level Security for all user-owned tables.
- Add JWT validation middleware in backend routes.
- Add request rate limiting for auth and jobs endpoints.
- Add structured audit logs for profile updates and outbound actions.

## 4. Mobile Readiness
- Add app icons, splash screen, and signed release build.
- Add privacy policy URL and terms URL in app settings.
- Add crash reporting (Firebase Crashlytics / Sentry).
- Add analytics events for onboarding completion and job apply clicks.

## 5. Play Store Submission Requirements
- Create a signed Android App Bundle (AAB).
- Add Data Safety form details (email, profile, analytics data usage).
- Add target age, content rating, and app category.
- Upload feature graphics, screenshots, and app description.
- Provide support email and website.

## 6. Functional QA Before Launch
- Google login and session restore across app restarts.
- New user flow routes to onboarding and saves selections.
- Existing user flow lands directly on dashboard with welcome popup.
- Live jobs endpoint returns results under normal network.
- Offline/slow network banner behavior is accurate.

## 7. Post-Launch Operations
- Monitor API latency and error rates.
- Daily job sync health checks and alerting.
- Weekly skill/role catalog updates from usage analytics.
- Incident response process for auth/job-feed outages.
