# University Admission App - Quick Start Guide

## 5-Minute Setup

### Step 1: Set Up Supabase Database (2 minutes)
1. Log into your Supabase project dashboard
2. Go to **SQL Editor** → **New Query**
3. Open `supabase_migration.sql` file from the project root
4. Copy and paste the entire content
5. Click **Run**
6. Wait for success message

### Step 2: Start the App (1 minute)
```bash
npm run dev:all
```

This starts both frontend (port 5173) and backend (port 8000).

### Step 3: Login (1 minute)
- Open https://prathi.tech
- Login with your email
- You're ready to go!

### Step 4: Try It Out (1 minute)
1. Click **University** in bottom navigation
2. Click **"Add University"** button
3. Fill in:
   - University Name: "Harvard University"
   - Country: "USA"
   - State: "Massachusetts"
   - Ranking: "1"
4. Click **Save University**
5. Try creating an application!

## What Each Tab Does

### 📚 Universities Tab
**Add your target universities**
- University name and location
- Ranking and acceptance rate
- Links to university websites
- Edit or delete universities

### 📋 Applications Tab
**Track your applications**
- Create applications for universities
- Monitor application status
- See statistics (total, accepted, rejected, etc.)
- Filter by status

### 📄 Documents Tab
**Manage your documents**
- Upload essays, transcripts, test scores
- Organize by application
- Download files anytime
- Delete old versions

## Common Tasks

### How to Add a University?
1. Go to **Universities** tab
2. Click **Add University** button
3. Fill in required info (Name, Country)
4. Optionally add ranking, acceptance rate, website
5. Click **Save University**

### How to Track an Application?
1. Go to **Applications** tab
2. Click **New Application**
3. Select university from dropdown
4. Set application date
5. Add notes (optional)
6. Click **Create Application**
7. Status updates appear after creation

### How to Upload Documents?
1. Go to **Documents** tab
2. Select application from dropdown
3. Click **Upload Documents**
4. Select files (PDF, DOC, JPG, PNG, XLS)
5. Files upload automatically
6. Download or delete anytime

## Features at a Glance

✅ **Add Universities** - Track schools you're applying to
✅ **Create Applications** - Link applications to universities
✅ **Update Status** - Monitor progress (pending → submitted → decided)
✅ **Upload Documents** - Store essays, transcripts, test scores
✅ **View Statistics** - See how many accepted, rejected, pending
✅ **Search & Filter** - Find universities and applications quickly
✅ **Secure Storage** - All your data is private and secure

## Keyboard Shortcuts

- **Escape**: Close any modal dialog
- **Enter**: Submit forms
- **Tab**: Navigate between fields

## Files You Should Know About

| File | Purpose |
|------|---------|
| `supabase_migration.sql` | Database schema - run this first! |
| `DATABASE_SETUP.md` | Detailed database setup instructions |
| `IMPLEMENTATION_SUMMARY.md` | Full feature list and technical details |
| `.env` | Contains Supabase URL and API key |
| `src/app/pages/UniversityAdmission.tsx` | Main app page |

## Getting Help

### "Supabase not configured" error?
- Check `.env` file has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart the dev server with `npm run dev:all`

### Can't upload documents?
- Ensure you've created an application first
- Check file is under 50MB
- Allowed formats: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX

### No universities showing?
- Make sure you've added at least one university first
- Click the **Add University** button in Universities tab

### Document bucket error?
- Run the SQL migration again - it creates the storage bucket
- Go to Supabase dashboard → Storage → check `application-documents` exists

## What's Built vs What's Coming

### Already Built ✅
- University database and management
- Application tracking with status
- Document upload and storage
- Search and filtering
- Statistics dashboard
- Complete database schema
- Multi-user support with security

### Coming Soon 🚀
- Email automation (Gmail integration)
- Deadline reminders and notifications
- Email history logs
- Dashboard charts and insights
- Application timeline
- Export to PDF/CSV
- Mobile app optimization

## Tips for Best Results

1. **Add universities first** - You need universities before creating applications
2. **Use detailed university info** - Add rankings and acceptance rates for better tracking
3. **Keep organized** - Add descriptive notes with applications
4. **Upload documents early** - Back up your important files to the vault
5. **Check statistics regularly** - See your application progress at a glance

## Estimated Time to Set Up Everything

- Database: 2 minutes
- Add 5 universities: 5 minutes
- Create 5 applications: 5 minutes
- Upload documents: 5 minutes
- **Total: ~20 minutes**

## Contact & Support

For issues:
1. Check the troubleshooting sections in this file
2. Review `DATABASE_SETUP.md` for detailed help
3. Check browser console (F12) for error messages
4. Verify Supabase dashboard shows your tables

## Next Steps After Setup

1. ✅ Set up database (you did this!)
2. ✅ Start the app
3. ✅ Login with email
4. ⬜ Add your target universities
5. ⬜ Create applications as you submit them
6. ⬜ Upload documents for each application
7. ⬜ Update statuses as you hear back
8. ⬜ Track your progress!

**Let's automate your university applications! 🎓**

