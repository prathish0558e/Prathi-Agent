import { runtimeConfig } from './runtimeConfig';
import type { University, Application, Document, Deadline, EmailLog } from '../types/university';

const safeJson = async <T>(response: Response): Promise<T> => {
  const data = (await response.json().catch(() => ({}))) as T;
  return data;
};

const assertOk = async (response: Response) => {
  if (response.ok) {
    return;
  }
  const payload = await safeJson<{ message?: string }>(response);
  throw new Error(payload.message || 'Admissions API request failed');
};

const admissionsUrl = (path: string) => `${runtimeConfig.apiBaseUrl}/admissions${path}`;

export async function createUniversity(university: Omit<University, 'id' | 'created_at' | 'updated_at'>) {
  const response = await fetch(admissionsUrl('/universities'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(university),
  });
  await assertOk(response);
  const payload = await safeJson<{ university: University }>(response);
  return payload.university;
}

export async function getUniversities(userId: string) {
  const response = await fetch(admissionsUrl(`/universities?${new URLSearchParams({ userId }).toString()}`));
  await assertOk(response);
  const payload = await safeJson<{ universities: University[] }>(response);
  return payload.universities || [];
}

export async function updateUniversity(id: string, updates: Partial<University>) {
  const response = await fetch(admissionsUrl(`/universities/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  await assertOk(response);
  const payload = await safeJson<{ university: University }>(response);
  return payload.university;
}

export async function deleteUniversity(id: string) {
  const response = await fetch(admissionsUrl(`/universities/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });
  await assertOk(response);
}

// Applications
export async function createApplication(application: Partial<Application>) {
  const response = await fetch(admissionsUrl('/applications'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(application),
  });
  await assertOk(response);
  const payload = await safeJson<{ application: Application }>(response);
  return payload.application;
}

export async function getApplications(userId: string) {
  const response = await fetch(admissionsUrl(`/applications?${new URLSearchParams({ userId }).toString()}`));
  await assertOk(response);
  const payload = await safeJson<{ applications: Application[] }>(response);
  return payload.applications || [];
}

export async function getApplicationWithDetails(applicationId: string) {
  const [applicationResponse, documents] = await Promise.all([
    fetch(admissionsUrl(`/applications/${encodeURIComponent(applicationId)}`)),
    getApplicationDocuments(applicationId),
  ]);

  await assertOk(applicationResponse);
  const payload = await safeJson<{ application: Application }>(applicationResponse);
  const matchedApplication = payload.application;

  return {
    ...matchedApplication,
    documents,
    deadlines: [],
  };
}

export async function updateApplication(id: string, updates: Partial<Application>) {
  const response = await fetch(admissionsUrl(`/applications/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  await assertOk(response);
  const payload = await safeJson<{ application: Application }>(response);
  return payload.application;
}

// Documents
export async function uploadDocument(document: Omit<Document, 'uploaded_at'>) {
  const response = await fetch(admissionsUrl('/documents'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  });
  await assertOk(response);
  const payload = await safeJson<{ document: Document }>(response);
  return payload.document;
}

export async function getApplicationDocuments(applicationId: string) {
  const response = await fetch(admissionsUrl(`/documents?${new URLSearchParams({ applicationId }).toString()}`));
  await assertOk(response);
  const payload = await safeJson<{ documents: Document[] }>(response);
  return payload.documents || [];
}

export async function deleteDocument(id: string, filePath: string) {
  const response = await fetch(admissionsUrl(`/documents/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });
  await assertOk(response);
}

// Deadlines
export async function createDeadline(deadline: Omit<Deadline, 'id' | 'created_at'>) {
  throw new Error('Deadline APIs are not implemented yet.');
}

export async function getApplicationDeadlines(applicationId: string) {
  return [] as Deadline[];
}

export async function updateDeadline(id: string, updates: Partial<Deadline>) {
  throw new Error('Deadline APIs are not implemented yet.');
}

// Email Logs
export async function logEmail(emailLog: Omit<EmailLog, 'id'>) {
  throw new Error('Email log APIs are not implemented yet.');
}

export async function getApplicationEmailLogs(applicationId: string) {
  return [] as EmailLog[];
}
