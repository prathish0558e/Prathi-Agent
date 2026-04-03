import { sendGmailMessage } from './gmailService.js';
import { getResumeBuffer } from './resumeStore.js';

const workerState = {
  timer: null,
  intervalMs: Number(process.env.AUTO_MAIL_INTERVAL_MINUTES || 15) * 60 * 1000,
  minConfidenceScore: Number(process.env.AUTO_MAIL_MIN_SCORE || 84),
  users: new Map(),
  sentRegistry: new Set(),
};

const buildSearchQuery = (roles = []) => (roles.length ? roles.slice(0, 3).join(' ') : 'software engineer');

const fetchCandidateJobs = async (roles) => {
  const query = buildSearchQuery(roles);
  const response = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`);
  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  return (payload.jobs || []).slice(0, 3);
};

const buildMailBody = (userConfig, job) => {
  const skills = (userConfig.primarySkills || []).slice(0, 6).join(', ');
  const location = userConfig.preferredLocations?.[0] || 'Flexible';

  return [
    `Hi Hiring Team at ${job.company_name},`,
    '',
    `I am writing to apply for the ${job.title} role.`,
    `Relevant skills: ${skills || 'See attached resume for details'}`,
    `Preferred location: ${location}`,
    '',
    'Please review my attached resume. Looking forward to your response.',
    '',
    'Regards,',
    userConfig.fullName || userConfig.email,
  ].join('\n');
};

const jobKey = (email, jobId) => `${email}:${jobId}:${new Date().toDateString()}`;

const scoreJobForUser = (userConfig, job) => {
  const roleTerms = (userConfig.targetRoles || [])
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  const skillTerms = (userConfig.primarySkills || [])
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const tags = Array.isArray(job.tags) ? job.tags.join(' ') : '';
  const text = `${job.title || ''} ${job.company_name || ''} ${job.description || ''} ${tags}`.toLowerCase();

  let score = 48;
  const roleMatches = roleTerms.filter((term) => text.includes(term));
  const skillMatches = skillTerms.filter((term) => text.includes(term));

  score += Math.min(24, roleMatches.length * 7);
  score += Math.min(26, skillMatches.length * 4);

  if (String(job.candidate_required_location || '').toLowerCase().includes('worldwide')) {
    score += 4;
  }

  return Math.min(100, score);
};

const processUser = async (userConfig) => {
  if (!userConfig.enabled || !userConfig.accessToken) {
    return;
  }

  const jobs = await fetchCandidateJobs(userConfig.targetRoles || []);
  if (jobs.length === 0) {
    return;
  }

  const shortlisted = jobs
    .map((job) => ({
      job,
      confidenceScore: scoreJobForUser(userConfig, job),
    }))
    .filter((item) => item.confidenceScore >= workerState.minConfidenceScore)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 2);

  if (shortlisted.length === 0) {
    return;
  }

  const resume = await getResumeBuffer(userConfig.email);
  const attachment = resume
    ? {
        fileName: resume.originalFileName || 'Resume.pdf',
        mimeType: resume.mimeType || 'application/pdf',
        base64Content: resume.buffer.toString('base64'),
      }
    : null;

  for (const { job, confidenceScore } of shortlisted) {
    const key = jobKey(userConfig.email, job.id);
    if (workerState.sentRegistry.has(key)) {
      continue;
    }

    const to = `hr@${String(job.company_name || 'company').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const subject = `Application for ${job.title} - ${userConfig.fullName || userConfig.email}`;

    try {
      await sendGmailMessage({
        accessToken: userConfig.accessToken,
        to,
        subject,
        body: `${buildMailBody(userConfig, job)}\n\nAuto-mail confidence score: ${confidenceScore}%`,
        attachment,
      });
      workerState.sentRegistry.add(key);
    } catch {
      // Ignore single job send failures and continue with next.
    }
  }
};

const tick = async () => {
  const users = Array.from(workerState.users.values());
  await Promise.all(users.map((user) => processUser(user)));
};

export const configureAutoMailUser = (config) => {
  workerState.users.set(config.email, {
    ...config,
    updatedAt: new Date().toISOString(),
  });
};

export const getAutoMailStatus = (email) => {
  return workerState.users.get(email) || null;
};

export const startAutoMailWorker = () => {
  if (workerState.timer) {
    return;
  }

  workerState.timer = setInterval(() => {
    void tick();
  }, workerState.intervalMs);
};
