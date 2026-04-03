import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { z } from 'zod';
import {
  getResumeBuffer,
  getResumeHistory,
  getResumeMeta,
  saveResumeFile,
  setActiveResumeById,
  setPreviousResumeActive,
} from '../lib/resumeStore.js';

export const resumeRouter = Router();

const LOG_SCOPE = '[resume-route]';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const emailQuerySchema = z.object({
  email: z.string().email(),
});

const activateGeneratedSchema = z.object({
  email: z.string().email(),
  fileName: z.string().min(3).max(120),
  base64Pdf: z.string().min(40),
  extractedText: z.string().optional(),
});

const activateHistorySchema = z.object({
  email: z.string().email(),
  resumeId: z.string().min(8),
});

const sendError = (response, statusCode, message, code, details) => {
  response.status(statusCode).json({
    status: 'error',
    code,
    message,
    ...(details ? { details } : {}),
  });
};

const isPdfBuffer = (buffer) => {
  if (!buffer || buffer.length < 5) {
    return false;
  }

  const header = buffer.subarray(0, 5).toString('ascii');
  return header === '%PDF-';
};

const checksumSha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

resumeRouter.post('/upload', upload.single('resume_file'), async (request, response) => {
  const emailResult = z.string().email().safeParse(request.body.email);
  if (!emailResult.success) {
    sendError(response, 400, 'Valid email is required.', 'INVALID_EMAIL');
    return;
  }

  if (!request.file) {
    sendError(response, 400, 'resume_file is required.', 'MISSING_FILE');
    return;
  }

  if (request.file.mimetype !== 'application/pdf') {
    sendError(response, 415, 'Only PDF uploads are supported.', 'UNSUPPORTED_MEDIA_TYPE');
    return;
  }

  if (!isPdfBuffer(request.file.buffer)) {
    sendError(response, 415, 'Uploaded content is not a valid PDF signature.', 'INVALID_FILE_SIGNATURE');
    return;
  }

  const checksum = checksumSha256(request.file.buffer);

  try {
    console.info(`${LOG_SCOPE} upload-start email=${emailResult.data} file=${request.file.originalname} size=${request.file.size} checksum=${checksum.slice(0, 12)}`);

    const parsed = await pdfParse(request.file.buffer);
    const extractedText = String(parsed.text || '').trim();

    const meta = await saveResumeFile({
      email: emailResult.data,
      originalFileName: request.file.originalname,
      mimeType: request.file.mimetype,
      buffer: request.file.buffer,
      extractedText,
      checksum,
    });

    console.info(`${LOG_SCOPE} upload-success email=${emailResult.data} resumeId=${meta.id} extractedTextLength=${extractedText.length}`);

    response.status(201).json({
      status: 'success',
      message: 'Resume processed and integrity verified.',
      resume: {
        id: meta.id,
        originalFileName: meta.originalFileName,
        savedAt: meta.savedAt,
        extractedTextLength: extractedText.length,
        checksum,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process resume upload.';
    console.error(`${LOG_SCOPE} upload-failure email=${emailResult.data} message=${message}`);
    sendError(response, 500, 'Internal server error during resume processing.', 'UPLOAD_PROCESSING_FAILED');
    return;
  }
});

resumeRouter.get('/latest', async (request, response) => {
  const payload = emailQuerySchema.safeParse(request.query);
  if (!payload.success) {
    sendError(response, 400, 'Valid email query is required.', 'INVALID_QUERY');
    return;
  }

  const meta = await getResumeMeta(payload.data.email);
  if (!meta) {
    sendError(response, 404, 'No resume found for this user.', 'RESUME_NOT_FOUND');
    return;
  }

  response.json({
    status: 'success',
    resume: {
      id: meta.id,
      originalFileName: meta.originalFileName,
      savedAt: meta.savedAt,
      extractedTextLength: String(meta.extractedText || '').length,
      resumeType: meta.resumeType || 'master',
      resumeCount: meta.resumeCount || 1,
      checksum: meta.checksum || '',
    },
  });
});

resumeRouter.get('/history', async (request, response) => {
  const payload = emailQuerySchema.safeParse(request.query);
  if (!payload.success) {
    sendError(response, 400, 'Valid email query is required.', 'INVALID_QUERY');
    return;
  }

  const history = await getResumeHistory(payload.data.email);
  response.json({
    status: 'success',
    history,
  });
});

resumeRouter.post('/activate-history', async (request, response) => {
  const payload = activateHistorySchema.safeParse(request.body);
  if (!payload.success) {
    sendError(response, 400, 'Invalid activate-history payload.', 'INVALID_ACTIVATE_HISTORY_PAYLOAD', payload.error.flatten());
    return;
  }

  const activated = await setActiveResumeById(payload.data.email, payload.data.resumeId);
  if (!activated) {
    sendError(response, 404, 'Requested resume version was not found.', 'RESUME_VERSION_NOT_FOUND');
    return;
  }

  response.json({
    status: 'success',
    message: 'Requested resume version is now active.',
    resume: activated,
  });
});

resumeRouter.post('/undo', async (request, response) => {
  const payload = z.object({ email: z.string().email() }).safeParse(request.body);
  if (!payload.success) {
    sendError(response, 400, 'Valid email is required for undo.', 'INVALID_EMAIL');
    return;
  }

  const previous = await setPreviousResumeActive(payload.data.email);
  if (!previous) {
    sendError(response, 400, 'No previous resume version available to restore.', 'NO_PREVIOUS_RESUME');
    return;
  }

  response.json({
    status: 'success',
    message: 'Previous resume version restored successfully.',
    resume: previous,
  });
});

resumeRouter.post('/activate-generated', async (request, response) => {
  const payload = activateGeneratedSchema.safeParse(request.body);
  if (!payload.success) {
    sendError(response, 400, 'Invalid generated resume payload.', 'INVALID_GENERATED_RESUME_PAYLOAD', payload.error.flatten());
    return;
  }

  try {
    const pdfBuffer = Buffer.from(payload.data.base64Pdf, 'base64');
    if (pdfBuffer.length === 0) {
      sendError(response, 400, 'Generated PDF buffer is empty.', 'EMPTY_GENERATED_PDF');
      return;
    }

    if (!isPdfBuffer(pdfBuffer)) {
      sendError(response, 415, 'Generated resume is not a valid PDF payload.', 'INVALID_GENERATED_PDF');
      return;
    }

    const checksum = checksumSha256(pdfBuffer);
    console.info(`${LOG_SCOPE} activate-generated email=${payload.data.email} checksum=${checksum.slice(0, 12)}`);

    const meta = await saveResumeFile({
      email: payload.data.email,
      originalFileName: payload.data.fileName,
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
      extractedText: payload.data.extractedText || '',
      resumeType: 'tailored',
      checksum,
    });

    response.json({
      status: 'success',
      message: 'Generated tailored resume is now active for HR mail sends.',
      resume: {
        id: meta.id,
        originalFileName: meta.originalFileName,
        savedAt: meta.savedAt,
        resumeType: meta.resumeType || 'tailored',
        checksum,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to activate generated resume.';
    console.error(`${LOG_SCOPE} activate-generated-failure email=${payload.data.email} message=${message}`);
    sendError(response, 500, 'Unable to activate generated resume.', 'ACTIVATE_GENERATED_FAILED');
  }
});

resumeRouter.get('/download', async (request, response) => {
  const payload = emailQuerySchema.safeParse(request.query);
  if (!payload.success) {
    sendError(response, 400, 'Valid email query is required.', 'INVALID_QUERY');
    return;
  }

  const resume = await getResumeBuffer(payload.data.email);
  if (!resume) {
    sendError(response, 404, 'No resume found for this user.', 'RESUME_NOT_FOUND');
    return;
  }

  console.info(`${LOG_SCOPE} download email=${payload.data.email} resumeId=${resume.id || 'unknown'} checksum=${(resume.checksum || '').slice(0, 12)}`);

  response.setHeader('Content-Type', resume.mimeType || 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${resume.originalFileName || 'resume.pdf'}"`);
  response.send(resume.buffer);
});
