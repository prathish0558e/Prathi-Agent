import { Router } from 'express';
import { z } from 'zod';
import { admissionsStore } from '../lib/admissionsStore.js';

export const admissionsRouter = Router();

const nonEmptyString = z.string().trim().min(1);
const programLevelSchema = z.enum(['bachelors', 'masters', 'phd', 'diploma', 'certificate', 'other']);

const universitySchema = z.object({
  user_id: nonEmptyString,
  name: nonEmptyString,
  country: nonEmptyString,
  state: z.string().optional(),
  ranking: z.coerce.number().int().positive().optional(),
  acceptance_rate: z.coerce.number().min(0).max(100).optional(),
  website: z.string().url().optional(),
  courses: z.array(nonEmptyString).optional(),
  apply_intent: z.boolean().optional(),
  program_level: programLevelSchema.optional(),
  admission_deadline: z.string().trim().optional(),
});

const applicationSchema = z.object({
  user_id: nonEmptyString,
  university_id: nonEmptyString,
  status: z.enum(['pending', 'submitted', 'accepted', 'rejected', 'waitlisted']).default('pending'),
  application_date: z.string().optional(),
  decision_date: z.string().optional(),
  notes: z.string().optional(),
});

const documentSchema = z.object({
  application_id: nonEmptyString,
  doc_type: z.enum(['essay', 'lor', 'transcript', 'test_score', 'other']).default('other'),
  file_name: nonEmptyString,
  file_path: nonEmptyString,
  file_size: z.coerce.number().nonnegative().default(0),
});

const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY || '';
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || '';
const MAX_CSE_RESULTS = 20;
const MAX_DEEP_SCAN = 6;

const cleanString = (value) => String(value ?? '').trim();
const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const PROGRAM_TERMS = {
  bachelors: ['bachelor', 'undergraduate', 'bs', 'bsc', 'b.tech', 'b.e'],
  masters: ['masters', 'ms', 'm.s', 'msc', 'm.tech', 'mtech', 'graduate'],
  phd: ['phd', 'doctorate'],
  diploma: ['diploma', 'postgraduate diploma'],
  certificate: ['certificate', 'certification', 'short course'],
  other: ['program', 'course'],
};

const buildProgramClause = (program) => {
  if (!program || program === 'all') {
    return '';
  }

  const terms = PROGRAM_TERMS[program] || [];
  if (terms.length === 0) {
    return program;
  }

  const normalized = terms.map((term) => (term.includes(' ') ? `"${term}"` : term));
  return `(${normalized.join(' OR ')})`;
};

const buildAdmissionsQuery = ({ query, course, program, country, intake }) => {
  const base = cleanString(query) || cleanString(course) || 'computer science';
  const programClause = buildProgramClause(program);
  const tokens = [base, programClause, 'admission', cleanString(intake), cleanString(country)];
  return tokens.filter(Boolean).join(' ').trim();
};

const fetchJson = async (url, timeoutMs = 9000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      return payload || { error: { message: `Google CSE request failed (HTTP ${response.status}).` } };
    }

    return payload;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchText = async (url, timeoutMs = 9000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return '';
    }

    return await response.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timeoutId);
  }
};

const stripHtml = (html) =>
  String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

const toValidDate = (year, month, day) => {
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
};

const extractDatesFromText = (text) => {
  const matches = [];
  const input = String(text || '');

  const monthNames = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const patternOne = new RegExp(`\\b${monthNames}\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+\\d{4}\\b`, 'gi');
  const patternTwo = new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${monthNames}\\s+\\d{4}\\b`, 'gi');
  const isoPattern = /\b\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\b/g;
  const numericPattern = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g;

  const pushDate = (date, raw) => {
    if (!date) {
      return;
    }
    matches.push({ date, raw });
  };

  input.match(patternOne)?.forEach((raw) => {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      pushDate(new Date(parsed), raw);
    }
  });

  input.match(patternTwo)?.forEach((raw) => {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      pushDate(new Date(parsed), raw);
    }
  });

  input.match(isoPattern)?.forEach((raw) => {
    const parts = raw.split(/[-\/.]/).map((part) => Number(part));
    if (parts.length === 3) {
      const [year, month, day] = parts;
      pushDate(toValidDate(year, month - 1, day), raw);
    }
  });

  input.match(numericPattern)?.forEach((raw) => {
    const parts = raw.split(/[\/-]/).map((part) => Number(part));
    if (parts.length !== 3) {
      return;
    }

    let [first, second, third] = parts;
    let year = third;
    if (year < 100) {
      year += 2000;
    }

    let month = first;
    let day = second;
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      day = second;
      month = first;
    }

    pushDate(toValidDate(year, month - 1, day), raw);
  });

  return matches;
};

const extractDeadlineFromText = (text) => {
  const normalized = normalizeWhitespace(text);
  const hasRolling = /rolling|open until filled|no deadline/i.test(normalized);
  if (hasRolling) {
    return { deadline: null, deadlineText: 'Rolling admission', isRolling: true };
  }

  const matches = extractDatesFromText(normalized);
  if (matches.length === 0) {
    return { deadline: null, deadlineText: null, isRolling: false };
  }

  const now = new Date();
  const upcoming = matches
    .filter((item) => item.date.getTime() >= now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (upcoming.length > 0) {
    return { deadline: upcoming[0].date, deadlineText: upcoming[0].raw, isRolling: false };
  }

  const latestPast = matches.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  return { deadline: latestPast.date, deadlineText: latestPast.raw, isRolling: false };
};

const findDeadlineContext = (text) => {
  const normalized = normalizeWhitespace(text);
  const match = normalized.match(/(deadline|application|apply by)[^\.]{0,220}/i);
  return match ? match[0] : normalized.slice(0, 4000);
};

const resolveDeadline = async ({ snippet, link, deep }) => {
  let { deadline, deadlineText, isRolling } = extractDeadlineFromText(snippet);

  if (!deadline && !isRolling && deep && link) {
    const html = await fetchText(link);
    if (html) {
      const text = findDeadlineContext(stripHtml(html));
      const deepResult = extractDeadlineFromText(text);
      deadline = deepResult.deadline;
      deadlineText = deepResult.deadlineText;
      isRolling = deepResult.isRolling;
    }
  }

  return { deadline, deadlineText, isRolling };
};

admissionsRouter.get('/universities', async (request, response) => {
  const userId = String(request.query.userId || '').trim();
  if (!userId) {
    response.status(400).json({ message: 'userId is required.' });
    return;
  }

  const universities = await admissionsStore.listUniversities(userId);
  response.json({ universities });
});

admissionsRouter.post('/universities', async (request, response) => {
  const parsed = universitySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Invalid university payload.', issues: parsed.error.flatten() });
    return;
  }

  const university = await admissionsStore.createUniversity(parsed.data);
  response.status(201).json({ university });
});

admissionsRouter.put('/universities/:id', async (request, response) => {
  const parsed = universitySchema.partial().safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Invalid university payload.', issues: parsed.error.flatten() });
    return;
  }

  const university = await admissionsStore.updateUniversity(request.params.id, parsed.data);
  if (!university) {
    response.status(404).json({ message: 'University not found.' });
    return;
  }

  response.json({ university });
});

admissionsRouter.delete('/universities/:id', async (request, response) => {
  await admissionsStore.deleteUniversity(request.params.id);
  response.status(204).send();
});

admissionsRouter.get('/applications', async (request, response) => {
  const userId = String(request.query.userId || '').trim();
  if (!userId) {
    response.status(400).json({ message: 'userId is required.' });
    return;
  }

  const applications = await admissionsStore.listApplications(userId);
  response.json({ applications });
});

admissionsRouter.get('/applications/:id', async (request, response) => {
  const application = await admissionsStore.getApplicationById(request.params.id);
  if (!application) {
    response.status(404).json({ message: 'Application not found.' });
    return;
  }

  response.json({ application });
});

admissionsRouter.post('/applications', async (request, response) => {
  const parsed = applicationSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Invalid application payload.', issues: parsed.error.flatten() });
    return;
  }

  const application = await admissionsStore.createApplication(parsed.data);
  response.status(201).json({ application });
});

admissionsRouter.patch('/applications/:id', async (request, response) => {
  const parsed = applicationSchema.partial().safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Invalid application update payload.', issues: parsed.error.flatten() });
    return;
  }

  const application = await admissionsStore.updateApplication(request.params.id, parsed.data);
  if (!application) {
    response.status(404).json({ message: 'Application not found.' });
    return;
  }

  response.json({ application });
});

admissionsRouter.get('/documents', async (request, response) => {
  const applicationId = String(request.query.applicationId || '').trim();
  if (!applicationId) {
    response.status(400).json({ message: 'applicationId is required.' });
    return;
  }

  const documents = await admissionsStore.listDocuments(applicationId);
  response.json({ documents });
});

admissionsRouter.post('/documents', async (request, response) => {
  const parsed = documentSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Invalid document payload.', issues: parsed.error.flatten() });
    return;
  }

  const document = await admissionsStore.createDocument(parsed.data);
  response.status(201).json({ document });
});

admissionsRouter.delete('/documents/:id', async (request, response) => {
  const document = await admissionsStore.deleteDocument(request.params.id);
  if (!document) {
    response.status(404).json({ message: 'Document not found.' });
    return;
  }

  response.json({ document });
});

admissionsRouter.get('/finder', async (request, response) => {
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
    response.status(400).json({ message: 'Google CSE is not configured. Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID.' });
    return;
  }

  const query = cleanString(request.query.query || request.query.q || '');
  const course = cleanString(request.query.course || '');
  const program = cleanString(request.query.program || 'masters');
  const country = cleanString(request.query.country || '');
  const intake = cleanString(request.query.intake || '');
  const openOnly = String(request.query.openOnly || '').toLowerCase() === 'true';
  const deep = String(request.query.deep || 'true').toLowerCase() !== 'false';
  const limit = Math.min(MAX_CSE_RESULTS, Math.max(3, Number(request.query.limit) || 10));

  const initialQuery = buildAdmissionsQuery({ query, course, program, country, intake });
  if (!initialQuery) {
    response.status(400).json({ message: 'Search query is required.' });
    return;
  }

  const runSearch = async (searchQuery) => {
    const fetchCsePage = async ({ start, num }) => {
      const params = new URLSearchParams({
        key: GOOGLE_CSE_API_KEY,
        cx: GOOGLE_CSE_ID,
        q: searchQuery,
        num: String(num),
        start: String(start),
      });

      const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
      const payload = await fetchJson(url, 12000);
      if (!payload) {
        return { items: [], error: { message: 'No response from Google CSE.' } };
      }

      if (payload.error) {
        return { items: [], error: payload.error };
      }

      return { items: Array.isArray(payload.items) ? payload.items : [], error: null };
    };

    const firstBatchCount = Math.min(10, limit);
    const tasks = [fetchCsePage({ start: 1, num: firstBatchCount })];
    if (limit > 10) {
      tasks.push(fetchCsePage({ start: 11, num: Math.min(10, limit - 10) }));
    }

    const pages = await Promise.all(tasks);
    const error = pages.find((page) => page.error)?.error;
    if (error) {
      return { items: [], error };
    }

    const items = pages.flatMap((page) => page.items).slice(0, limit);
    return { items, error: null };
  };

  let effectiveQuery = initialQuery;
  let { items, error } = await runSearch(effectiveQuery);
  if (error) {
    response.status(502).json({ message: error.message || 'Google CSE request failed.' });
    return;
  }

  if (items.length === 0 && intake) {
    effectiveQuery = buildAdmissionsQuery({ query, course, program, country, intake: '' });
    ({ items, error } = await runSearch(effectiveQuery));
  }

  if (items.length === 0 && program && program !== 'all') {
    effectiveQuery = buildAdmissionsQuery({ query, course, program: 'all', country, intake: '' });
    ({ items, error } = await runSearch(effectiveQuery));
  }

  if (error) {
    response.status(502).json({ message: error.message || 'Google CSE request failed.' });
    return;
  }
  const now = new Date();

  const enriched = await Promise.all(
    items.map(async (item, index) => {
      const snippet = cleanString(item.snippet || item.htmlSnippet || '');
      const deepAllowed = deep && index < MAX_DEEP_SCAN;
      const { deadline, deadlineText, isRolling } = await resolveDeadline({
        snippet,
        link: item.link,
        deep: deepAllowed,
      });

      let deadlineStatus = 'unknown';
      if (deadline) {
        deadlineStatus = deadline.getTime() >= now.getTime() ? 'open' : 'closed';
      } else if (isRolling) {
        deadlineStatus = 'open';
      }

      return {
        title: cleanString(item.title || item.link || 'Admission'),
        link: cleanString(item.link || ''),
        displayLink: cleanString(item.displayLink || ''),
        snippet,
        deadline: deadline ? deadline.toISOString() : null,
        deadlineText: deadlineText || null,
        deadlineStatus,
        program: program || null,
        course: course || query || null,
        country: country || null,
        intake: intake || null,
        source: 'google-cse',
      };
    }),
  );

  const filtered = openOnly ? enriched.filter((item) => item.deadlineStatus === 'open') : enriched;

  response.json({
    query: effectiveQuery,
    count: filtered.length,
    results: filtered,
    fetchedAt: new Date().toISOString(),
  });
});
