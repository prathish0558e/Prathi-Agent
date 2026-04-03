export type ProgramLevel = 'bachelors' | 'masters' | 'phd' | 'diploma' | 'certificate' | 'other';

export interface University {
  id: string;
  user_id: string;
  name: string;
  country: string;
  state?: string;
  ranking?: number;
  acceptance_rate?: number;
  website?: string;
  courses?: string[];
  apply_intent?: boolean;
  program_level?: ProgramLevel;
  admission_deadline?: string;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  university_id: string;
  status: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'waitlisted';
  application_date: string;
  decision_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  application_id: string;
  doc_type: 'essay' | 'lor' | 'transcript' | 'test_score' | 'other';
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

export interface Deadline {
  id: string;
  application_id: string;
  deadline_name: string;
  deadline_date: string;
  reminder_sent: boolean;
  completed: boolean;
  created_at: string;
}

export interface EmailLog {
  id: string;
  application_id: string;
  email_type: 'status_update' | 'deadline_reminder' | 'acceptance_notification' | 'other';
  recipient: string;
  subject: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
}

export interface ApplicationWithDetails extends Application {
  university?: University;
  documents?: Document[];
  deadlines?: Deadline[];
}
