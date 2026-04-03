import { promises as fs } from 'fs';
import path from 'path';

const storageRoot = path.resolve(process.cwd(), 'storage');
const resumesDir = path.join(storageRoot, 'resumes');
const metadataPath = path.join(storageRoot, 'resume-metadata.json');

const sanitizeEmail = (email = '') => email.toLowerCase().replace(/[^a-z0-9@._-]/g, '');

const loadMetadata = async () => {
  try {
    const raw = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const saveMetadata = async (metadata) => {
  await fs.mkdir(storageRoot, { recursive: true });
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
};

const normalizeUserRecord = (normalizedEmail, rawRecord) => {
  if (!rawRecord) {
    return {
      email: normalizedEmail,
      activeResumeId: null,
      resumes: [],
    };
  }

  if (Array.isArray(rawRecord.resumes)) {
    return {
      email: rawRecord.email || normalizedEmail,
      activeResumeId: rawRecord.activeResumeId || rawRecord.resumes[0]?.id || null,
      resumes: rawRecord.resumes,
    };
  }

  if (rawRecord.filePath) {
    const legacyId = `legacy_${Date.now()}`;
    return {
      email: rawRecord.email || normalizedEmail,
      activeResumeId: legacyId,
      resumes: [
        {
          id: legacyId,
          originalFileName: rawRecord.originalFileName || 'resume.pdf',
          mimeType: rawRecord.mimeType || 'application/pdf',
          filePath: rawRecord.filePath,
          savedAt: rawRecord.savedAt || new Date().toISOString(),
          extractedText: rawRecord.extractedText || '',
          resumeType: rawRecord.resumeType || 'master',
          checksum: rawRecord.checksum || '',
        },
      ],
    };
  }

  return {
    email: normalizedEmail,
    activeResumeId: null,
    resumes: [],
  };
};

export const saveResumeFile = async ({ email, originalFileName, mimeType, buffer, extractedText, resumeType = 'master', checksum = '' }) => {
  const normalizedEmail = sanitizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Invalid email for resume storage.');
  }

  await fs.mkdir(resumesDir, { recursive: true });

  const extension = path.extname(originalFileName || '').toLowerCase() || '.pdf';
  const safeName = `${normalizedEmail.replace(/[@.]/g, '_')}_${Date.now()}${extension}`;
  const filePath = path.join(resumesDir, safeName);

  await fs.writeFile(filePath, buffer);

  const metadata = await loadMetadata();
  const userRecord = normalizeUserRecord(normalizedEmail, metadata[normalizedEmail]);

  const entry = {
    id: `resume_${Date.now()}`,
    originalFileName: originalFileName || safeName,
    mimeType: mimeType || 'application/pdf',
    filePath,
    savedAt: new Date().toISOString(),
    extractedText: extractedText || '',
    resumeType,
    checksum,
  };

  userRecord.resumes.push(entry);
  userRecord.activeResumeId = entry.id;
  metadata[normalizedEmail] = userRecord;

  await saveMetadata(metadata);

  return entry;
};

export const getResumeMeta = async (email) => {
  const normalizedEmail = sanitizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const metadata = await loadMetadata();
  const userRecord = normalizeUserRecord(normalizedEmail, metadata[normalizedEmail]);
  const activeResume = userRecord.resumes.find((resume) => resume.id === userRecord.activeResumeId) || userRecord.resumes.at(-1) || null;
  if (!activeResume) {
    return null;
  }

  return {
    ...activeResume,
    activeResumeId: userRecord.activeResumeId,
    resumeCount: userRecord.resumes.length,
  };
};

export const getResumeBuffer = async (email) => {
  const meta = await getResumeMeta(email);
  if (!meta) {
    return null;
  }

  try {
    const buffer = await fs.readFile(meta.filePath);
    return {
      ...meta,
      buffer,
    };
  } catch {
    return null;
  }
};

export const getResumeHistory = async (email) => {
  const normalizedEmail = sanitizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const metadata = await loadMetadata();
  const userRecord = normalizeUserRecord(normalizedEmail, metadata[normalizedEmail]);

  return [...userRecord.resumes]
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .map((resume) => ({
      id: resume.id,
      originalFileName: resume.originalFileName,
      savedAt: resume.savedAt,
      resumeType: resume.resumeType || 'master',
      checksum: resume.checksum || '',
      isActive: resume.id === userRecord.activeResumeId,
    }));
};

export const setActiveResumeById = async (email, resumeId) => {
  const normalizedEmail = sanitizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const metadata = await loadMetadata();
  const userRecord = normalizeUserRecord(normalizedEmail, metadata[normalizedEmail]);
  const found = userRecord.resumes.find((resume) => resume.id === resumeId);
  if (!found) {
    return null;
  }

  userRecord.activeResumeId = found.id;
  metadata[normalizedEmail] = userRecord;
  await saveMetadata(metadata);

  return {
    id: found.id,
    originalFileName: found.originalFileName,
    savedAt: found.savedAt,
    resumeType: found.resumeType || 'master',
    checksum: found.checksum || '',
  };
};

export const setPreviousResumeActive = async (email) => {
  const normalizedEmail = sanitizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const metadata = await loadMetadata();
  const userRecord = normalizeUserRecord(normalizedEmail, metadata[normalizedEmail]);
  if (userRecord.resumes.length < 2) {
    return null;
  }

  const sorted = [...userRecord.resumes].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  const currentIndex = sorted.findIndex((resume) => resume.id === userRecord.activeResumeId);
  const fallbackIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
  const previous = sorted[fallbackIndex];
  if (!previous) {
    return null;
  }

  userRecord.activeResumeId = previous.id;
  metadata[normalizedEmail] = userRecord;
  await saveMetadata(metadata);

  return {
    id: previous.id,
    originalFileName: previous.originalFileName,
    savedAt: previous.savedAt,
    resumeType: previous.resumeType || 'master',
    checksum: previous.checksum || '',
  };
};
