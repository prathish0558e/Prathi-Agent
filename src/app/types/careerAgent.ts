export type JobSource =
  | 'LinkedIn'
  | 'Indeed'
  | 'Company Career Page'
  | 'Referral'
  | 'Remotive'
  | 'Arbeitnow'
  | 'RemoteOK'
  | 'Adzuna'
  | 'TheMuse';

export interface JobOpportunity {
  id: string | number;
  company: string;
  role: string;
  location: string;
  type: 'Full-time' | 'Internship' | 'Contract' | 'Remote';
  logo: string;
  source: JobSource;
  matchPercentage: number;
  interviewChance: number;
  securityScore: number;
  verified: boolean;
  requiresResumeTailor: boolean;
  applyUrl?: string | null;
  salary?: string | null;
  hrEmail?: string | null;
  hrEmailConfidence?: number;
  hrEmailSource?: 'job-posting' | 'domain-guess' | 'unavailable';
  hrEmailStatus?: 'verified' | 'unverified' | 'unavailable';
  contactPhone?: string | null;
  posterName?: string | null;
  publishedAt?: string | null;
  tags?: string[];
  isNew?: boolean;
}

export type MailActivityStatus = 'scheduled' | 'viewed' | 'pending';

export interface MailActivity {
  id: number;
  company: string;
  position: string;
  status: MailActivityStatus;
  timestamp: string;
  message: string;
}

export interface ResumeInsight {
  atsBefore: number;
  atsAfter: number;
  missingKeywords: string[];
  recommendedHighlights: string[];
}