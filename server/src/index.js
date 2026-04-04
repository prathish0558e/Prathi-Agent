import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env first (override empty values), then fallback root .env for local dev convenience.
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import routes only after dotenv is loaded so module-level env reads are correct.
const { aiRouter } = await import('./routes/ai.js');
const { admissionsRouter } = await import('./routes/admissions.js');
const { authRouter } = await import('./routes/auth.js');
const { emailRouter } = await import('./routes/email.js');
const { jobsRouter } = await import('./routes/jobs.js');
const { notificationsRouter } = await import('./routes/notifications.js');
const { profileRouter } = await import('./routes/profile.js');
const { resumeRouter } = await import('./routes/resume.js');

const app = express();
const port = Number(process.env.PORT ?? 8000);
const defaultAllowedOrigins = [
  'https://prathi.tech',
  'https://www.prathi.tech',
  'https://agent.prathi.tech',
  'https://www.agent.prathi.tech',
];
const configuredAllowedOrigins = String(process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins]);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/', (_request, response) => {
  response.json({ status: 'ok', service: 'career-agent-server', hint: 'Use /health for status checks.' });
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'career-agent-server' });
});

app.use('/auth', authRouter);
app.use('/ai', aiRouter);
app.use('/admissions', admissionsRouter);
app.use('/email', emailRouter);
app.use('/profile', profileRouter);
app.use('/jobs', jobsRouter);
app.use('/notifications', notificationsRouter);
app.use('/resume', resumeRouter);

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error?.message === 'Not allowed by CORS') {
    response.status(403).json({ message: 'CORS blocked: add your frontend domain to ALLOWED_ORIGIN.' });
    return;
  }

  response.status(500).json({ message: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`career-agent-server listening on port ${port}`);
});
