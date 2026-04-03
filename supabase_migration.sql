-- University Admission Automation App - Database Schema
-- Run this migration in Supabase SQL Editor

-- Create universities table
CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  ranking INTEGER,
  acceptance_rate DECIMAL(5, 2),
  website VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, name, country)
);

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'accepted', 'rejected', 'waitlisted')),
  application_date DATE NOT NULL,
  decision_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN ('essay', 'lor', 'transcript', 'test_score', 'other')),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create deadlines table
CREATE TABLE IF NOT EXISTS deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  deadline_name VARCHAR(255) NOT NULL,
  deadline_date DATE NOT NULL,
  reminder_sent BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('status_update', 'deadline_reminder', 'acceptance_notification', 'other')),
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending'))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_universities_user_id ON universities(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_university_id ON applications(university_id);
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_application_id ON deadlines(application_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_application_id ON email_logs(application_id);

-- Enable Row Level Security (RLS)
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for universities
CREATE POLICY "Users can view their own universities"
  ON universities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create universities"
  ON universities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own universities"
  ON universities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own universities"
  ON universities FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for applications
CREATE POLICY "Users can view their own applications"
  ON applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create applications"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
  ON applications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own applications"
  ON applications FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for documents
CREATE POLICY "Users can view documents for their applications"
  ON documents FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload documents"
  ON documents FOR INSERT
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their documents"
  ON documents FOR DELETE
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for deadlines
CREATE POLICY "Users can view deadlines for their applications"
  ON deadlines FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create deadlines"
  ON deadlines FOR INSERT
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their deadlines"
  ON deadlines FOR UPDATE
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for email_logs
CREATE POLICY "Users can view email logs for their applications"
  ON email_logs FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create email logs"
  ON email_logs FOR INSERT
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

-- Create storage bucket for application documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-documents', 'application-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users can upload documents to their folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'application-documents' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can download their documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'application-documents' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );
