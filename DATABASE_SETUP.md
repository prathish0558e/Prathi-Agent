# University Admission Automation App - Setup Guide

## Database Setup Instructions

This application requires Supabase tables and storage bucket to be set up. Follow these steps:

### 1. Access Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**

### 2. Run the Migration

1. Copy the entire content from `supabase_migration.sql` in the project root
2. Paste it into the SQL Editor
3. Click **Run** to execute the migration

This will create:
- `universities` table
- `applications` table
- `documents` table
- `deadlines` table
- `email_logs` table
- Row Level Security (RLS) policies for all tables
- Storage bucket `application-documents`

### 3. Verify Setup

After running the migration:

1. Go to **Authentication → Policies** in Supabase dashboard
2. You should see RLS policies for each table
3. Go to **Storage** and verify `application-documents` bucket exists

### 4. Environment Configuration

Make sure your `.env` file has:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Core Features Implemented

### Phase 1: Database Schema ✅
- Universities table with metadata (ranking, acceptance rate, location)
- Applications table with status tracking
- Documents table for file storage
- Deadlines table for tracking important dates
- Email logs table for communication history
- Row Level Security for multi-user safety

### Phase 2: UI Components ✅
- **UniversityTracker**: Add, view, edit, delete universities
- **AddUniversityModal**: Form for adding/editing universities
- **ApplicationTracker**: View applications with status filtering
- **DocumentVault**: Upload, download, delete application documents

### Phase 3: Core Functions
- University management (CRUD operations)
- Application tracking with status updates
- Document management with Supabase Storage
- Deadline reminders setup

## Running the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev:all

# Or frontend only
npm run dev:client
```

## Using the Features

### Add a University
1. Click "Add University" button in University Tracker
2. Fill in university name and country (required)
3. Optional: Add ranking, acceptance rate, website
4. Click "Save University"

### Track Applications
1. Go to Applications tab
2. Click "New Application"
3. Select university and set application date
4. Update status as you progress (pending → submitted → accepted/rejected)

### Manage Documents
1. Go to Document Vault
2. Select an application from the dropdown
3. Click "Upload Documents"
4. Upload essays, transcripts, test scores, etc.
5. Download or delete documents as needed

## Next Steps (Phases Not Yet Implemented)

### Phase 4: Email Automation
- Gmail API integration for sending emails
- Email template system
- Automated deadline reminders

### Phase 5: Advanced Features
- Dashboard with statistics
- Email history and logs
- Notification preferences
- Export application data

### Phase 6: Polish & Testing
- Full test suite
- Performance optimization
- Mobile optimization (Capacitor)
- Error handling and logging

## Troubleshooting

### "Supabase not configured"
- Verify `.env` file has correct URL and anon key
- Restart the dev server after adding environment variables

### RLS Policy Errors
- Ensure you're logged in with a valid email
- Check that RLS policies were created in the migration
- Verify in Supabase dashboard that policies exist for your tables

### File Upload Issues
- Ensure `application-documents` bucket exists in Storage
- Check bucket permissions allow authenticated users
- Verify file size is under Supabase limits (typically 50MB)

## File Structure

```
src/
├── app/
│   ├── components/
│   │   ├── UniversityTracker.tsx
│   │   ├── AddUniversityModal.tsx
│   │   ├── ApplicationTracker.tsx
│   │   └── DocumentVault.tsx
│   ├── lib/
│   │   ├── supabaseClient.ts
│   │   └── universityDb.ts
│   ├── types/
│   │   └── university.ts
│   └── auth/
│       └── AuthContext.tsx
└── supabase_migration.sql
```

## API Reference

### University Functions
- `createUniversity(data)` - Add new university
- `getUniversities(userId)` - Get all universities
- `updateUniversity(id, updates)` - Update university
- `deleteUniversity(id)` - Delete university

### Application Functions
- `createApplication(data)` - Create application
- `getApplications(userId)` - Get all applications
- `updateApplication(id, updates)` - Update application status

### Document Functions
- `uploadDocument(data)` - Upload document metadata
- `getApplicationDocuments(applicationId)` - Get documents for app
- `deleteDocument(id, filePath)` - Delete document

### Deadline Functions
- `createDeadline(data)` - Create deadline reminder
- `getApplicationDeadlines(applicationId)` - Get deadlines
- `updateDeadline(id, updates)` - Update deadline

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase documentation: https://supabase.com/docs
3. Check application console for error messages
