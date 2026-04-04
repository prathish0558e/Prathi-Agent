# Career Agent App - Setup & Configuration Guide

## ⚠️ OAuth Sign-In Not Working?

If you're getting "Unable to exchange external code" error, see **[OAuth_Troubleshooting.md](./OAuth_Troubleshooting.md)** for step-by-step fixes.

---

## ✅ What's Configured

### 1. Supabase Authentication (New!)
This app now uses **Supabase** for secure authentication instead of direct backend OAuth.

**Setup Steps:**
1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → API → Copy `Project URL` and `Anon Key`
4. In your app, add these environment variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Go to Authentication → Providers → Google
6. Enable Google provider
7. Add Google OAuth credentials (see step 2 below)
8. Add redirect URLs:
   - `https://prathi.tech/#/auth/callback` (local dev)
   - `https://prathi.tech/#/auth/callback` (production)

### 2. Google OAuth Credentials
```
✓ GOOGLE_CLIENT_ID=from-google-console
✓ GOOGLE_CLIENT_SECRET=from-google-console
```

**Get these from Google Cloud Console:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable the following APIs:
   - Gmail API (for email features)
   - Google Places API (for company finder)
4. Go to APIs & Services → Credentials
5. Create OAuth 2.0 Client ID:
   - Type: Web application
   - Name: Career Agent
   - Authorized JavaScript origins:
     - `https://prathi.tech`
     - `https://prathi.tech`
   - Authorized redirect URIs:
     - `https://prathi.tech/#/auth/callback`
     - `https://prathi.tech/#/auth/callback`
6. Copy Client ID and Secret
7. Paste into Supabase Google Provider settings

### 3. Gmail OAuth (Direct Consent)
```
✓ GOOGLE_CLIENT_ID=placeholder-dev-client-id
✓ GOOGLE_CLIENT_SECRET=placeholder-dev-client-secret
✓ SERVER_ORIGIN=https://api.prathi.tech
✓ WEB_ORIGIN=https://prathi.tech
```

**Note**: For production Gmail consent, get real OAuth credentials from [Google Cloud Console](https://console.cloud.google.com):
1. Create project
2. Enable Gmail API
3. Create OAuth 2.0 Client ID (Web application)
4. Add redirect URIs: `https://api.prathi.tech/auth/google/callback`
5. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `server/.env`

### 4. Job Sources - 10+ APIs (Expanded!)
Now fetching from **10+ job boards** for massive job supply:

| Source | Type | Coverage |
|--------|------|----------|
| **Remotive** | Remote job board API | Global remote jobs |
| **ArbeitNow** | Job aggregator API | Europe + Remote |
| **RemoteOK** | Remote work API | Global remote |
| **TheMuse** | Tech job board API | US tech startups |
| **Adzuna** | 50+ country job API | Multi-country (needs key) |
| **Jobicy** | Remote jobs API | Worldwide |
| **FindWork** | Tech job board | Developer jobs |
| **GitHub Jobs** | GitHub job board API | Developer-focused |
| **Dev.to** | Dev community jobs | Tech community |
| **Internshala** | Internship platform | Internships worldwide |

**Total Job Pool**: 300-500 jobs per query (after deduplication)

### 3. Email Sync (Fixed)
✓ Auto-token refresh when expired  
✓ 5-minute periodic polling  
✓ Retry logic with one retry attempt  
✓ Better error messages for users  

### 4. HR Email Extraction
✓ Scrapes job posting pages for `mailto:` links  
✓ Scores email quality (is it real HR?)  
✓ Extracts phone numbers  
✓ Finds recruiter names  

### 5. Local Job Feed
✓ Geography-based job matching  
✓ City-level filtering  
✓ Radius search (50-100km)  
✓ Tamil Nadu boost queries for better local results  

## 🚀 Running the App

### Frontend (React + Vite)
```bash
npm run dev:client
# Runs on https://prathi.tech
```

### Backend (Express + Node)
```bash
cd server
npm run dev
# Runs on https://api.prathi.tech
```

### Both Together
```bash
npm run dev:all
```

## 📡 API Endpoints

### Job Search
```bash
GET /jobs/feed?query=react+developer&limit=30&deep=true
# Returns 300+ jobs from 8 sources, sorted by match %

GET /jobs/feed?query=nodejs&country=in&experienceLevel=fresher
# Fresher-focused search for India
```

### Local Jobs
```bash
GET /jobs/local-feed?city=Chennai&keyword=developer&radiusKm=50
# Location-based job search
```

### Nearby Companies  
```bash
GET /jobs/nearby-companies?city=Bangalore&radiusKm=75&keyword=IT
# Find tech companies near you (Google Maps + OpenStreetMap)
```

### HR Email Extraction
```bash
POST /jobs/scrape/career-emails
{
  "companies": [
    {"name": "Google", "website": "https://google.com"},
    {"name": "Microsoft", "website": "https://microsoft.com"}
  ]
}
# Returns verified HR emails + contact phones
```

### Watch Companies
```bash
POST /jobs/watch/openings
{
  "companies": ["Google", "Microsoft"],
  "roleTitle": "Software Engineer",
  "city": "Bangalore"
}
# Get jobs from specific companies
```

## 🔐 Environment Variables

### Required
```env
# Frontend URLs
VITE_API_BASE_URL=https://api.prathi.tech
VITE_GOOGLE_OAUTH_ENABLED=true

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Server URLs  
SERVER_ORIGIN=https://api.prathi.tech
WEB_ORIGIN=https://prathi.tech

# API Keys (Optional, but gets more jobs with them)
ADZUNA_APP_ID=your-app-id
ADZUNA_APP_KEY=your-app-key
GOOGLE_PLACES_API_KEY=your-places-key
```

### Optional but Recommended
```env
# For AI resume matching
GEMINI_API_KEY=your-gemini-key

# For local company discovery
GOOGLE_PLACES_PREMIUM_ENABLED=true

# Rate limiting
AUTO_MAIL_INTERVAL_MINUTES=15
```

## 📊 Job Sourcing Algorithm

1. **Parallel Fetch**: Hits all 8 APIs simultaneously (6 seconds total)
2. **Normalization**: Converts different JSON formats to unified schema
3. **Deduplication**: Removes same job from multiple sources
4. **Filtering**: 
   - Query term matching (skill, company, location)
   - Experience level (fresher, mid, senior)
   - Job type (remote, on-site, hybrid)
5. **Scoring**: AI matches job to user profile (40-100%)
6. **Caching**: Results cached for 5 minutes (fast repeat searches)
7. **HR Email enrichment**: Scrapes pages for real HR contacts (30-40 jobs max to avoid overload)

## 🎯 Performance

- **Job Search**: ~6-8 seconds (parallel API calls)
- **HR Email extraction**: +2-3 seconds per 10 jobs
- **Cache hit**: <200ms
- **Total jobs returned**: 30-100 per request (after filtering)
- **Verified HR emails**: 20-40% of jobs get verified contact

## ⚠️ Known Limitations

1. **StackOverflow Jobs** - Closed their official API, using RSS scraping (less reliable)
2. **Adzuna** - Requires free API registration for full access
3. **HR Emails** - Some job boards block scraping (e.g., LinkedIn)
4. **Rate limiting** - Some APIs rate limit at 100-1000 requests/hour

## ✨ Features Enabled

✅ **Gmail Sync** - Auto-refresh + 5-min polling  
✅ **8 Job Sources** - From remote boards to enterprise ATS  
✅ **AI Matching** - Skill-based job ranking  
✅ **HR Email Finder** - Scrapes pages for contact data  
✅ **Local Search** - Geo-based job discovery  
✅ **Company Watch** - Monitor specific companies  
✅ **Resume Parsing** - Skill extraction from PDFs  
✅ **Auto Email** - Send applications with resume attachment  

## 🔧 Troubleshooting

### "No jobs found"
- Check if queries are too specific
- Try without location filter first
- Enable `?deep=true` for deeper search

### "Gmail token error"
- Run: `GET /auth/google/start?returnTo=https://prathi.tech`
- Accept permissions on Google consent screen
- Token auto-refreshes after expiry

### "Jobs not showing emails"
- Give endpoint 2-3 sec to scrape pages
- Some job boards block scraping
- Check browser console for errors

### "Server won't start"
- Kill existing: `netstat -ano | findstr :8000`
- Check `.env` file exists
- Run `npm install` in server folder

## 📚 Next Steps

1. **Get API Keys**:
   - [Adzuna](https://www.adzuna.com/api) - Free tier: 5000 req/month
   - [Google Places](https://developers.google.com/maps/billing-and-pricing) - Free tier: $200/month credit
   - [Gemini](https://makersuite.google.com) - Free tier: 60 req/min

2. **Test Endpoints**:
   ```bash
   curl "https://api.prathi.tech/jobs/feed?query=developer&limit=10"
   ```

3. **Set Up Database** (Optional):
   - Configure Supabase for job storage
   - Enable PostgreSQL tables
   - Run schema migration

4. **Production Deployment**:
   - Get real Google OAuth credentials
   - Use environment-specific `.env` files
   - Set up CI/CD pipeline
   - Deploy on Vercel/Railway/Heroku

---

**Built with ❤️ for job seekers in 2026**

