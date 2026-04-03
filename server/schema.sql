create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists career_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email_hash text not null unique,
  email_ciphertext bytea not null,
  full_name_ciphertext bytea not null,
  phone_hash text,
  phone_ciphertext bytea,
  experience_level text not null check (experience_level in ('Fresher', 'Intern', 'Junior', 'Mid-Level')),
  target_roles jsonb not null default '[]'::jsonb,
  primary_skills jsonb not null default '[]'::jsonb,
  preferred_locations jsonb not null default '[]'::jsonb,
  wants_auto_apply boolean not null default false,
  wants_mail_automation boolean not null default false,
  resume_file_name text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references career_profiles(id) on delete cascade,
  storage_path text not null,
  original_file_name text not null,
  extracted_text_ciphertext bytea,
  checksum_sha256 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resumes_checksum_sha256_length check (char_length(checksum_sha256) = 64)
);

create table if not exists gmail_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references career_profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  access_token_ciphertext bytea not null,
  refresh_token_ciphertext bytea not null,
  token_fingerprint text not null unique,
  scopes jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references career_profiles(id) on delete cascade,
  provider text not null,
  thread_id text,
  sender_email_hash text,
  sender_email_ciphertext bytea,
  subject_ciphertext bytea,
  classification text,
  payload_ciphertext bytea,
  created_at timestamptz not null default now()
);

create table if not exists job_opportunities (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  role text not null,
  location text,
  source text not null,
  source_url text,
  verified boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists job_matches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references career_profiles(id) on delete cascade,
  job_id uuid not null references job_opportunities(id) on delete cascade,
  match_percentage integer not null check (match_percentage between 0 and 100),
  interview_chance integer not null check (interview_chance between 0 and 100),
  missing_keywords jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (profile_id, job_id)
);

create table if not exists outbound_mail_audit (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references career_profiles(id) on delete cascade,
  email_event_id uuid references email_events(id) on delete set null,
  action text not null check (action in ('drafted', 'approved', 'sent', 'blocked')),
  destination_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_career_profiles_email_hash on career_profiles(email_hash);
create index if not exists idx_career_profiles_phone_hash on career_profiles(phone_hash);
create index if not exists idx_email_events_profile_id_created_at on email_events(profile_id, created_at desc);
create index if not exists idx_job_matches_profile_id_created_at on job_matches(profile_id, created_at desc);
create index if not exists idx_job_opportunities_verified_created_at on job_opportunities(verified, created_at desc);
create index if not exists idx_outbound_mail_audit_profile_id_created_at on outbound_mail_audit(profile_id, created_at desc);

drop trigger if exists trg_career_profiles_set_updated_at on career_profiles;
create trigger trg_career_profiles_set_updated_at
before update on career_profiles
for each row
execute function set_updated_at();

drop trigger if exists trg_resumes_set_updated_at on resumes;
create trigger trg_resumes_set_updated_at
before update on resumes
for each row
execute function set_updated_at();

drop trigger if exists trg_gmail_tokens_set_updated_at on gmail_tokens;
create trigger trg_gmail_tokens_set_updated_at
before update on gmail_tokens
for each row
execute function set_updated_at();

drop trigger if exists trg_job_opportunities_set_updated_at on job_opportunities;
create trigger trg_job_opportunities_set_updated_at
before update on job_opportunities
for each row
execute function set_updated_at();

alter table career_profiles enable row level security;
alter table resumes enable row level security;
alter table gmail_tokens enable row level security;
alter table email_events enable row level security;
alter table job_matches enable row level security;
alter table outbound_mail_audit enable row level security;

drop policy if exists career_profiles_select_own on career_profiles;
create policy career_profiles_select_own on career_profiles
for select using (auth.uid() = id);

drop policy if exists career_profiles_update_own on career_profiles;
create policy career_profiles_update_own on career_profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists career_profiles_insert_own on career_profiles;
create policy career_profiles_insert_own on career_profiles
for insert with check (auth.uid() = id);

drop policy if exists resumes_access_own on resumes;
create policy resumes_access_own on resumes
for all using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists gmail_tokens_access_own on gmail_tokens;
create policy gmail_tokens_access_own on gmail_tokens
for all using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists email_events_access_own on email_events;
create policy email_events_access_own on email_events
for all using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists job_matches_access_own on job_matches;
create policy job_matches_access_own on job_matches
for all using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists outbound_mail_audit_access_own on outbound_mail_audit;
create policy outbound_mail_audit_access_own on outbound_mail_audit
for all using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists job_opportunities_verified_read on job_opportunities;
create policy job_opportunities_verified_read on job_opportunities
for select using (verified = true);

create table if not exists universities (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  country text not null,
  state text,
  ranking integer,
  acceptance_rate numeric(5,2),
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  university_id uuid not null references universities(id) on delete cascade,
  status text not null check (status in ('pending', 'submitted', 'accepted', 'rejected', 'waitlisted')),
  application_date date not null,
  decision_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  doc_type text not null check (doc_type in ('essay', 'lor', 'transcript', 'test_score', 'other')),
  file_name text not null,
  file_path text not null,
  file_size bigint not null default 0,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_universities_user_id_created_at on universities(user_id, created_at desc);
create index if not exists idx_applications_user_id_created_at on applications(user_id, created_at desc);
create index if not exists idx_documents_application_id_uploaded_at on documents(application_id, uploaded_at desc);

drop trigger if exists trg_universities_set_updated_at on universities;
create trigger trg_universities_set_updated_at
before update on universities
for each row
execute function set_updated_at();

drop trigger if exists trg_applications_set_updated_at on applications;
create trigger trg_applications_set_updated_at
before update on applications
for each row
execute function set_updated_at();

alter table universities enable row level security;
alter table applications enable row level security;
alter table documents enable row level security;

drop policy if exists universities_access_own on universities;
create policy universities_access_own on universities
for all using (user_id = auth.jwt() ->> 'email')
with check (user_id = auth.jwt() ->> 'email');

drop policy if exists applications_access_own on applications;
create policy applications_access_own on applications
for all using (user_id = auth.jwt() ->> 'email')
with check (user_id = auth.jwt() ->> 'email');

drop policy if exists documents_access_own on documents;
create policy documents_access_own on documents
for all using (
  exists (
    select 1 from applications a
    where a.id = documents.application_id
      and a.user_id = auth.jwt() ->> 'email'
  )
)
with check (
  exists (
    select 1 from applications a
    where a.id = documents.application_id
      and a.user_id = auth.jwt() ->> 'email'
  )
);
