import { Router } from 'express';
import { z } from 'zod';
import { configureAutoMailUser, getAutoMailStatus, startAutoMailWorker } from '../lib/autoMailWorker.js';
import { diagnoseTokenScopes, fetchGmail, requiredMailScopes, sendGmailMessage } from '../lib/gmailService.js';
import { getResumeBuffer } from '../lib/resumeStore.js';

export const emailRouter = Router();

const summarySchema = z.object({
  accessToken: z.string().min(20),
});

const sendSchema = z.object({
  accessToken: z.string().min(20),
  to: z.string().email(),
  subject: z.string().min(3),
  body: z.string().min(20),
  userEmail: z.string().email(),
});

const automationSchema = z.object({
  accessToken: z.string().min(20),
  email: z.string().email(),
  enabled: z.boolean(),
  fullName: z.string().optional(),
  targetRoles: z.array(z.string()).default([]),
  primarySkills: z.array(z.string()).default([]),
  preferredLocations: z.array(z.string()).default([]),
});

startAutoMailWorker();

const mapGmailError = (message, statusCode) => {
  const normalized = String(message || '').toLowerCase();

  // Check for token expiry/invalid token (401)
  if (statusCode === 401 || normalized.includes('invalid_grant') || normalized.includes('token expired')) {
    return {
      statusCode: 401,
      message: 'Google Mail token expired or invalid. Please reconnect your Google account.',
      actionItems: [
        'Click Reconnect Google Mail Access button',
        'Or logout and login again to refresh token',
      ],
    };
  }

  if (normalized.includes('service_disabled') || normalized.includes('accessnotconfigured')) {
    return {
      statusCode: 503,
      message:
        'Gmail API is disabled in your Google Cloud project. Enable Gmail API in Google Cloud Console for the same project linked to your OAuth client, then wait 2-5 minutes and retry.',
      actionItems: [
        'Open Google Cloud Console -> APIs & Services -> Library',
        'Search and enable Gmail API',
        'Ensure you are in project 382905055590 (or your OAuth project)',
        'Retry after propagation delay (usually 2-5 minutes)',
      ],
    };
  }

  if (normalized.includes('insufficient authentication scopes') || normalized.includes('access_token_scope_insufficient')) {
    return {
      statusCode: 403,
      message: 'Google token has insufficient Gmail scopes. Logout and login again with Google consent.',
      actionItems: [
        'Logout from app',
        'Login again using Continue with Google',
        'Accept Gmail read/send permissions on consent screen',
      ],
    };
  }

  return {
    statusCode: statusCode || 502,
    message: String(message || 'Gmail request failed.'),
  };
};

emailRouter.post('/diagnose-token', async (request, response) => {
  const payload = summarySchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ message: 'Invalid token payload', issues: payload.error.flatten() });
    return;
  }

  try {
    const diagnosis = await diagnoseTokenScopes(payload.data.accessToken);
    response.json({
      diagnosis,
      requiredScopes: requiredMailScopes,
      fixHint:
        diagnosis.missingScopes.length > 0
          ? 'Re-login with Google and grant Gmail scopes. In Supabase Google provider, add additional scopes: gmail.readonly gmail.send.'
          : 'Token scopes are sufficient.',
    });
  } catch (error) {
    const statusCode = error.status || (error instanceof Error ? undefined : 502);
    const mapped = mapGmailError(error instanceof Error ? error.message : 'Unable to inspect token.', statusCode);
    response.status(mapped.statusCode).json({ message: mapped.message, actionItems: mapped.actionItems || [] });
  }
});

emailRouter.post('/summary', async (request, response) => {
  const payload = summarySchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ message: 'Invalid email summary payload', issues: payload.error.flatten() });
    return;
  }

  try {
    const { accessToken } = payload.data;

    const diagnosis = await diagnoseTokenScopes(accessToken);
    if (diagnosis.missingScopes.length > 0) {
      response.status(403).json({
        message: 'Insufficient Gmail scopes. Re-login with Google and grant mail scopes.',
        missingScopes: diagnosis.missingScopes,
      });
      return;
    }

    const inboxQuery = encodeURIComponent('in:inbox (job OR interview OR recruiter OR hr OR application) newer_than:45d');
    const sentQuery = encodeURIComponent('in:sent (job OR interview OR recruiter OR hr OR application) newer_than:45d');

    const [inboxList, sentList] = await Promise.all([
      fetchGmail(`/messages?q=${inboxQuery}&maxResults=25`, accessToken),
      fetchGmail(`/messages?q=${sentQuery}&maxResults=25`, accessToken),
    ]);

    const inboxMessages = inboxList.messages || [];
    const sentMessages = sentList.messages || [];

    const recentIds = inboxMessages.slice(0, 6).map((message) => message.id);
    const recentDetails = await Promise.all(
      recentIds.map((id) =>
        fetchGmail(`/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, accessToken),
      ),
    );

    const recentActivity = recentDetails.map((message) => {
      const headers = message.payload?.headers || [];
      const findHeader = (name) => headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || '';
      return {
        id: message.id,
        from: findHeader('From'),
        subject: findHeader('Subject') || '(No Subject)',
        date: findHeader('Date'),
      };
    });

    response.json({
      inboxJobMailCount: inboxMessages.length,
      sentReplyCount: sentMessages.length,
      recentActivity,
    });
  } catch (error) {
    const statusCode = error.status || (error instanceof Error ? undefined : 502);
    const mapped = mapGmailError(error instanceof Error ? error.message : 'Unable to fetch Gmail summary.', statusCode);
    response.status(mapped.statusCode).json({ message: mapped.message, actionItems: mapped.actionItems || [] });
  }
});

emailRouter.post('/send-job-application', async (request, response) => {
  const payload = sendSchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ message: 'Invalid send payload', issues: payload.error.flatten() });
    return;
  }

  try {
    const { accessToken, to, subject, body, userEmail } = payload.data;

    const diagnosis = await diagnoseTokenScopes(accessToken);
    if (diagnosis.missingScopes.length > 0) {
      response.status(403).json({
        message: 'Insufficient Gmail scopes for send action. Re-login and grant required scopes.',
        missingScopes: diagnosis.missingScopes,
      });
      return;
    }

    const storedResume = await getResumeBuffer(userEmail);
    if (!storedResume) {
      response.status(400).json({
        message: 'No uploaded PDF resume found. Upload resume in AI Resume page before sending HR mail.',
      });
      return;
    }

    const attachment = {
      fileName: storedResume.originalFileName || 'Resume.pdf',
      mimeType: storedResume.mimeType || 'application/pdf',
      base64Content: storedResume.buffer.toString('base64'),
    };

    const sentData = await sendGmailMessage({
      accessToken,
      to,
      subject,
      body,
      attachment,
    });

    response.json({
      message: 'Application mail sent successfully with your uploaded resume PDF.',
      id: sentData.id,
      attachmentUsed: true,
      attachmentFileName: attachment.fileName,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    const statusCode = error.status || (error instanceof Error ? undefined : 502);
    const mapped = mapGmailError(error instanceof Error ? error.message : 'Unable to send mail.', statusCode);
    response.status(mapped.statusCode).json({ message: mapped.message, actionItems: mapped.actionItems || [] });
  }
});

emailRouter.post('/automation/config', (request, response) => {
  const payload = automationSchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ message: 'Invalid automation payload', issues: payload.error.flatten() });
    return;
  }

  configureAutoMailUser(payload.data);
  response.json({ message: 'Automation configuration updated.', status: payload.data });
});

emailRouter.get('/automation/status', (request, response) => {
  const email = String(request.query.email || '').trim().toLowerCase();
  if (!email) {
    response.status(400).json({ message: 'email query is required.' });
    return;
  }

  const status = getAutoMailStatus(email);
  if (!status) {
    response.status(404).json({ message: 'No automation config for this email.' });
    return;
  }

  response.json({ status });
});
