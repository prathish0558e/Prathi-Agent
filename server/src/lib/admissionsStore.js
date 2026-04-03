import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storagePath = path.resolve(__dirname, '../../storage/admissions-data.json');

const emptyData = {
  universities: [],
  applications: [],
  documents: [],
};

let writeQueue = Promise.resolve();

const ensureStorageFile = async () => {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  try {
    await fs.access(storagePath);
  } catch {
    await fs.writeFile(storagePath, JSON.stringify(emptyData, null, 2), 'utf8');
  }
};

const readData = async () => {
  await ensureStorageFile();
  try {
    const raw = await fs.readFile(storagePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      universities: Array.isArray(parsed.universities) ? parsed.universities : [],
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    };
  } catch {
    return { ...emptyData };
  }
};

const writeData = async (payload) => {
  writeQueue = writeQueue.then(() => fs.writeFile(storagePath, JSON.stringify(payload, null, 2), 'utf8'));
  await writeQueue;
};

const nowIso = () => new Date().toISOString();

const sanitizeString = (value) => String(value ?? '').trim();

export const admissionsStore = {
  async listUniversities(userId) {
    const data = await readData();
    return data.universities
      .filter((item) => item.user_id === userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  async createUniversity(payload) {
    const data = await readData();
    const next = {
      id: randomUUID(),
      user_id: sanitizeString(payload.user_id),
      name: sanitizeString(payload.name),
      country: sanitizeString(payload.country),
      state: sanitizeString(payload.state) || null,
      ranking: Number.isFinite(Number(payload.ranking)) ? Number(payload.ranking) : null,
      acceptance_rate: Number.isFinite(Number(payload.acceptance_rate)) ? Number(payload.acceptance_rate) : null,
      website: sanitizeString(payload.website) || null,
      courses: Array.isArray(payload.courses)
        ? payload.courses.map((course) => sanitizeString(course)).filter(Boolean)
        : [],
      apply_intent: Boolean(payload.apply_intent),
      program_level: sanitizeString(payload.program_level) || null,
      admission_deadline: sanitizeString(payload.admission_deadline) || null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    data.universities.push(next);
    await writeData(data);
    return next;
  },

  async updateUniversity(universityId, payload) {
    const data = await readData();
    const index = data.universities.findIndex((item) => item.id === universityId);
    if (index < 0) {
      return null;
    }

    const previous = data.universities[index];
    const updated = {
      ...previous,
      name: payload.name !== undefined ? sanitizeString(payload.name) : previous.name,
      country: payload.country !== undefined ? sanitizeString(payload.country) : previous.country,
      state: payload.state !== undefined ? sanitizeString(payload.state) || null : previous.state,
      ranking:
        payload.ranking !== undefined
          ? Number.isFinite(Number(payload.ranking))
            ? Number(payload.ranking)
            : null
          : previous.ranking,
      acceptance_rate:
        payload.acceptance_rate !== undefined
          ? Number.isFinite(Number(payload.acceptance_rate))
            ? Number(payload.acceptance_rate)
            : null
          : previous.acceptance_rate,
      website: payload.website !== undefined ? sanitizeString(payload.website) || null : previous.website,
      courses:
        payload.courses !== undefined
          ? Array.isArray(payload.courses)
            ? payload.courses.map((course) => sanitizeString(course)).filter(Boolean)
            : []
          : previous.courses ?? [],
      apply_intent: payload.apply_intent !== undefined ? Boolean(payload.apply_intent) : previous.apply_intent ?? false,
      program_level:
        payload.program_level !== undefined ? sanitizeString(payload.program_level) || null : previous.program_level ?? null,
      admission_deadline:
        payload.admission_deadline !== undefined
          ? sanitizeString(payload.admission_deadline) || null
          : previous.admission_deadline ?? null,
      updated_at: nowIso(),
    };

    data.universities[index] = updated;
    await writeData(data);
    return updated;
  },

  async deleteUniversity(universityId) {
    const data = await readData();
    const toDeleteAppIds = new Set(data.applications.filter((item) => item.university_id === universityId).map((item) => item.id));

    data.universities = data.universities.filter((item) => item.id !== universityId);
    data.applications = data.applications.filter((item) => !toDeleteAppIds.has(item.id));
    data.documents = data.documents.filter((item) => !toDeleteAppIds.has(item.application_id));

    await writeData(data);
  },

  async listApplications(userId) {
    const data = await readData();
    return data.applications
      .filter((item) => item.user_id === userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  async getApplicationById(applicationId) {
    const data = await readData();
    return data.applications.find((item) => item.id === applicationId) || null;
  },

  async createApplication(payload) {
    const data = await readData();
    const next = {
      id: randomUUID(),
      user_id: sanitizeString(payload.user_id),
      university_id: sanitizeString(payload.university_id),
      status: ['pending', 'submitted', 'accepted', 'rejected', 'waitlisted'].includes(payload.status) ? payload.status : 'pending',
      application_date: sanitizeString(payload.application_date) || nowIso().slice(0, 10),
      decision_date: sanitizeString(payload.decision_date) || null,
      notes: sanitizeString(payload.notes) || null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    data.applications.push(next);
    await writeData(data);
    return next;
  },

  async updateApplication(applicationId, payload) {
    const data = await readData();
    const index = data.applications.findIndex((item) => item.id === applicationId);
    if (index < 0) {
      return null;
    }

    const previous = data.applications[index];
    const updated = {
      ...previous,
      status:
        payload.status !== undefined && ['pending', 'submitted', 'accepted', 'rejected', 'waitlisted'].includes(payload.status)
          ? payload.status
          : previous.status,
      application_date:
        payload.application_date !== undefined ? sanitizeString(payload.application_date) || previous.application_date : previous.application_date,
      decision_date: payload.decision_date !== undefined ? sanitizeString(payload.decision_date) || null : previous.decision_date,
      notes: payload.notes !== undefined ? sanitizeString(payload.notes) || null : previous.notes,
      updated_at: nowIso(),
    };

    data.applications[index] = updated;
    await writeData(data);
    return updated;
  },

  async listDocuments(applicationId) {
    const data = await readData();
    return data.documents
      .filter((item) => item.application_id === applicationId)
      .sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1));
  },

  async createDocument(payload) {
    const data = await readData();
    const next = {
      id: randomUUID(),
      application_id: sanitizeString(payload.application_id),
      doc_type: sanitizeString(payload.doc_type) || 'other',
      file_name: sanitizeString(payload.file_name),
      file_path: sanitizeString(payload.file_path),
      file_size: Number.isFinite(Number(payload.file_size)) ? Number(payload.file_size) : 0,
      uploaded_at: nowIso(),
    };

    data.documents.push(next);
    await writeData(data);
    return next;
  },

  async deleteDocument(documentId) {
    const data = await readData();
    const existing = data.documents.find((item) => item.id === documentId) || null;
    data.documents = data.documents.filter((item) => item.id !== documentId);
    await writeData(data);
    return existing;
  },
};
