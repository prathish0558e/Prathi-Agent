import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { getResumeMeta } from '../lib/resumeStore.js';

export const aiRouter = Router();

const resumeTailorSchema = z.object({
  resumeText: z.string().optional(),
  email: z.string().email().optional(),
  useStoredResume: z.boolean().default(false),
  jobDescription: z.string().min(40),
  targetRole: z.string().min(2),
  company: z.string().optional(),
  level: z.enum(['fresher', 'experienced']).default('experienced'),
});

const structuredResultSchema = z.object({
  score: z.number().min(0).max(100),
  gapReason: z.string(),
  summary: z.array(z.string()),
  skills: z.array(z.string()),
  projects: z.array(z.string()),
  experience: z.array(z.string()),
  missingSkills: z.array(z.string()),
  atsKeywordsAdded: z.array(z.string()),
});

const resumePdfSchema = z.object({
  name: z.string().default('Candidate'),
  contact: z.string().default(''),
  targetRole: z.string().default('Software Engineer'),
  company: z.string().default('Target Company'),
  candidateLevel: z.enum(['fresher', 'experienced']).default('experienced'),
  summary: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  projects: z.array(z.string()).default([]),
  experience: z.array(z.string()).default([]),
  education: z.array(z.string()).default([]),
  missingSkills: z.array(z.string()).default([]),
  score: z.number().min(0).max(100).default(70),
  gapReason: z.string().default(''),
});

const buildPrompt = ({ resumeText, jobDescription, targetRole, company, level }) => {
  return [
    'You are a senior ATS resume optimizer and hiring panel advisor.',
    `Target role: ${targetRole}`,
    `Target company: ${company || 'Not specified'}`,
    `Candidate level: ${level}`,
    'Return ONLY strict JSON, no markdown and no extra keys.',
    'JSON schema:',
    JSON.stringify(
      {
        score: 92,
        gapReason: 'Short reason for score gaps',
        summary: ['bullet1', 'bullet2', 'bullet3', 'bullet4'],
        skills: ['skill1', 'skill2'],
        projects: ['project bullet 1', 'project bullet 2'],
        experience: ['experience bullet 1', 'experience bullet 2'],
        missingSkills: ['missing1', 'missing2'],
        atsKeywordsAdded: ['keyword1', 'keyword2'],
      },
      null,
      2,
    ),
    'Rules:',
    '- Use strong action verbs and measurable outcomes (X-Y-Z formula).',
    '- Every bullet should follow: Accomplished X as measured by Y, by doing Z.',
    '- Start each bullet with a strong action verb: Engineered, Automated, Optimized, Built, Designed, Led, Streamlined, Reduced, Increased.',
    '- Quantify ONLY when evidence exists in resume text or job description. Avoid fabricated numbers.',
    '- If metric is unknown, keep impact language without numbers (e.g., improved reliability, reduced manual effort).',
    '- Tailor deeply to JD keywords and responsibilities.',
    '- Write premium, professional, recruiter-friendly content.',
    '- Avoid vague statements. Every bullet must convey impact.',
    '- Summary should be 2-3 crisp sentences (return each sentence as one summary item).',
    '- Skills list must include only skills present in resume text; add missing ATS keywords in missingSkills.',
    '- Projects and experience bullets should be interview-ready and impact-focused.',
    '- Each project item MUST use format: "Project Title: impact sentence".',
    '- Keep each bullet concise and professional (max 24 words).',
    '- Score should be realistic for ATS fit against JD.',
    '- Missing skills must be concrete technologies/tools and not generic words.',
    level === 'fresher'
      ? '- Fresher mode: keep resume content compact for ONE-PAGE output, with strong projects and internship impact.'
      : '- Experienced mode: prioritize measurable production impact and ownership. Multi-page allowed.',
    '',
    `Resume text:\n${resumeText}`,
    '',
    `Job description:\n${jobDescription}`,
  ].join('\n');
};

const callGeminiStructured = async (prompt) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini request failed: ${details}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
};

const normalizeStructuredResult = (input) => {
  const parsed = structuredResultSchema.safeParse({
    score: Number(input.score ?? 70),
    gapReason: String(input.gapReason ?? input.gap_reason ?? 'Needs stronger role-specific evidence.'),
    summary: Array.isArray(input.summary) ? input.summary : String(input.summary || '').split('\n').filter(Boolean),
    skills: Array.isArray(input.skills) ? input.skills : String(input.skills || '').split(',').map((item) => item.trim()).filter(Boolean),
    projects: Array.isArray(input.projects) ? input.projects : [],
    experience: Array.isArray(input.experience) ? input.experience : [],
    missingSkills: Array.isArray(input.missingSkills)
      ? input.missingSkills
      : Array.isArray(input.missing_skills)
        ? input.missing_skills
        : [],
    atsKeywordsAdded: Array.isArray(input.atsKeywordsAdded)
      ? input.atsKeywordsAdded
      : Array.isArray(input.ats_keywords_added)
        ? input.ats_keywords_added
        : [],
  });

  if (!parsed.success) {
    return {
      score: 70,
      gapReason: 'AI output had formatting issues. Showing safe fallback.',
      summary: ['Candidate profile requires stronger role alignment and measurable outcomes.'],
      skills: [],
      projects: [],
      experience: [],
      missingSkills: [],
      atsKeywordsAdded: [],
    };
  }

  return parsed.data;
};

const ACTION_VERBS = new Set([
  'engineered',
  'automated',
  'optimized',
  'built',
  'designed',
  'led',
  'streamlined',
  'reduced',
  'increased',
  'implemented',
  'developed',
  'delivered',
  'architected',
  'spearheaded',
  'resolved',
]);

const ensureActionVerb = (text, fallbackVerb) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return '';
  }

  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() || '';
  if (ACTION_VERBS.has(firstWord)) {
    return trimmed;
  }

  return `${fallbackVerb} ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
};

const ensureImpact = (text) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return '';
  }

  const hasMetric = /\b\d+(?:\.\d+)?%?\b/.test(trimmed);
  const hasImpactVerb = /(improved|reduced|increased|optimized|accelerated|saved|boosted|streamlined|automated|hardened|secured|stabilized|cut|lifted|expanded|delivered|achieved)/i.test(trimmed);
  if (hasMetric || hasImpactVerb) {
    return trimmed;
  }

  return `${trimmed} resulting in higher quality and delivery reliability.`;
};

const enhanceBullets = (items, fallbackVerb) =>
  items
    .map((item) => ensureImpact(ensureActionVerb(item, fallbackVerb)))
    .filter(Boolean);

const ensureMinimumProfessionalDepth = (structured, context) => {
  const role = context.targetRole || 'Software Engineer';
  const company = context.company || 'the target company';
  const isFresher = context.level === 'fresher';
  const resumeText = String(context.resumeText || '').toLowerCase();

  const pushIfMissing = (list, value) => {
    if (!list.includes(value)) {
      list.push(value);
    }
  };

  const summary = [...structured.summary];
  const experience = [...structured.experience];
  const projects = [...structured.projects];
  const skills = [...structured.skills];

  if (isFresher) {
    pushIfMissing(summary, `${role} candidate focused on project execution, ATS alignment, and clean engineering fundamentals.`);
    pushIfMissing(summary, `Built portfolio-grade projects mapped to ${company} role expectations.`);
    pushIfMissing(summary, 'Strong in problem solving, documentation, and production-ready coding practices.');
    pushIfMissing(summary, 'Learns fast and converts new tools into deliverable outcomes quickly.');
    pushIfMissing(summary, 'Focused on quality delivery, testing discipline, and maintainable codebases.');
    pushIfMissing(summary, 'Ready to contribute in agile teams with clear ownership and communication.');

    pushIfMissing(experience, `Completed internship/training-style implementation tasks aligned to ${role} responsibilities.`);
    pushIfMissing(experience, 'Supported feature delivery with testing, debugging, and code quality improvements.');
    pushIfMissing(experience, 'Collaborated in team sprints and documented implementation outcomes clearly.');
    pushIfMissing(experience, 'Applied security and validation basics during API/UI development.');
    pushIfMissing(experience, 'Built and validated REST endpoints with input validation and error handling.');
    pushIfMissing(experience, 'Delivered responsive UI updates with accessibility and performance focus.');

    pushIfMissing(projects, `Built a role-focused project portfolio aligned with ${company} hiring goals.`);
    pushIfMissing(projects, 'Delivered project modules with measurable results, clean structure, and deployment readiness.');
    pushIfMissing(projects, 'Implemented validation, authentication, and error handling for reliability.');
    pushIfMissing(projects, 'Presented architecture decisions and trade-offs in a concise technical narrative.');
    pushIfMissing(projects, 'Integrated third-party APIs and managed secure authentication flows.');
    pushIfMissing(projects, 'Documented setup and deployment steps for repeatable delivery.');
  } else {
    pushIfMissing(summary, `Delivered end-to-end ${role} features aligned to business KPIs and release timelines.`);
    pushIfMissing(summary, 'Collaborated with cross-functional teams to improve quality, reliability, and customer impact.');
    pushIfMissing(summary, 'Optimized development workflows, testing quality, and deployment confidence.');
    pushIfMissing(summary, 'Built scalable modules with clean architecture and long-term maintainability focus.');
    pushIfMissing(summary, `Prepared interview-ready project narratives for ${company} role expectations.`);
    pushIfMissing(summary, 'Owned reliability outcomes with monitoring, performance tuning, and incident reduction.');

    pushIfMissing(experience, 'Engineered production-ready components and APIs with measurable performance gains.');
    pushIfMissing(experience, 'Improved code quality through reviews, refactoring, and structured testing practices.');
    pushIfMissing(experience, 'Reduced incidents by introducing validation, monitoring, and defensive error handling.');
    pushIfMissing(experience, 'Partnered with stakeholders to convert product requirements into technical deliverables.');
    pushIfMissing(experience, 'Maintained documentation and release notes for smoother team handovers.');
    pushIfMissing(experience, `Contributed to delivery planning and sprint execution for ${role} scope.`);
    pushIfMissing(experience, 'Standardized reusable patterns and playbooks to accelerate team delivery.');

    pushIfMissing(projects, `Built a role-focused portfolio project aligned with ${company} hiring expectations.`);
    pushIfMissing(projects, 'Implemented analytics and observability to track feature impact and stability.');
    pushIfMissing(projects, 'Designed reusable modules that reduced duplicate implementation efforts.');
    pushIfMissing(projects, 'Demonstrated measurable outcomes with before/after execution metrics.');
  }

  [...structured.atsKeywordsAdded, ...structured.missingSkills].slice(0, 10).forEach((skill) => {
    if (!skill) {
      return;
    }

    const normalized = String(skill).toLowerCase();
    if (resumeText.includes(normalized) && !skills.includes(skill)) {
      skills.push(skill);
    }
  });

  const enhancedSummary = enhanceBullets(summary, 'Delivered');
  const enhancedExperience = enhanceBullets(experience, 'Engineered');
  const enhancedProjects = enhanceBullets(projects, 'Built');

  return {
    ...structured,
    summary: enhancedSummary.slice(0, isFresher ? 6 : 6),
    experience: enhancedExperience.slice(0, isFresher ? 6 : 10),
    projects: enhancedProjects.slice(0, isFresher ? 6 : 6),
    skills: skills.slice(0, isFresher ? 20 : 24),
  };
};

aiRouter.post('/resume-tailor-preview', async (request, response) => {
  const payload = resumeTailorSchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ message: 'Invalid AI request payload', issues: payload.error.flatten() });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    response.status(503).json({ message: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  try {
    let resumeText = payload.data.resumeText || '';

    if (payload.data.useStoredResume && payload.data.email) {
      const meta = await getResumeMeta(payload.data.email);
      if (meta?.extractedText) {
        resumeText = meta.extractedText;
      }
    }

    if (resumeText.trim().length < 40) {
      response.status(400).json({ message: 'Resume text is missing. Upload resume first or provide resume text.' });
      return;
    }

    const prompt = buildPrompt({
      resumeText,
      jobDescription: payload.data.jobDescription,
      targetRole: payload.data.targetRole,
      company: payload.data.company,
      level: payload.data.level,
    });

    const rawResult = await callGeminiStructured(prompt);
    const structured = ensureMinimumProfessionalDepth(normalizeStructuredResult(rawResult), {
      ...payload.data,
      resumeText,
    });

    response.json({
      structured,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate tailored resume.';
    response.status(502).json({ message });
  }
});

aiRouter.post('/resume-tailor-pdf', async (request, response) => {
  const payload = resumePdfSchema.safeParse(request.body);
  if (!payload.success) {
    response.status(400).json({ message: 'Invalid PDF payload', issues: payload.error.flatten() });
    return;
  }

  const data = payload.data;
  const isFresher = data.candidateLevel === 'fresher';
  const doc = new PDFDocument({ size: 'A4', margin: isFresher ? 30 : 34 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(chunks);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="Optimized_Resume.pdf"');
    response.send(pdfBuffer);
  });

  const palette = {
    text: '#111111',
    muted: '#333333',
    rule: '#111111',
  };

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = isFresher ? 30 : 34;
  const contentWidth = pageWidth - margin * 2;
  const bottomY = pageHeight - margin;

  const safeSummary = (data.summary || []).filter(Boolean);
  const safeSkills = Array.from(new Set(data.skills || [])).filter(Boolean);
  const safeExperience = (data.experience || []).filter(Boolean);
  const safeProjects = (data.projects || []).filter(Boolean);
  const safeEducation = (data.education || []).filter(Boolean);

  const limits = isFresher
    ? { summary: 5, skills: 20, experience: 5, projects: 6, education: 3 }
    : { summary: 5, skills: 24, experience: 8, projects: 6, education: 3 };
  const typography = isFresher
    ? { name: 20, contact: 9.6, section: 11, body: 10.4, lineGap: 2.6 }
    : { name: 19, contact: 9.2, section: 10.8, body: 10, lineGap: 2.2 };

  const allowPagination = !isFresher;

  const ensureSpace = (height) => {
    if (doc.y + height <= bottomY) {
      return true;
    }

    if (!allowPagination) {
      return false;
    }

    doc.addPage();
    drawMiniHeader();
    return true;
  };

  const drawRule = () => {
    doc.strokeColor(palette.rule).lineWidth(0.9).moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).stroke();
    doc.moveDown(0.5);
  };

  const drawHeader = () => {
    const name = String(data.name || 'Candidate').toUpperCase();
    const contact = String(data.contact || '').replace(/\s+\|/g, ' | ').replace(/\s{2,}/g, ' ').trim();

    doc.fillColor(palette.text).font('Helvetica-Bold').fontSize(typography.name).text(name, margin, margin, {
      width: contentWidth,
      align: 'center',
    });

    if (contact) {
      doc.font('Helvetica').fontSize(typography.contact).fillColor(palette.muted).text(contact, margin, doc.y + 2, {
        width: contentWidth,
        align: 'center',
      });
    }

    doc.moveDown(0.6);
    drawRule();
  };

  const drawMiniHeader = () => {
    const name = String(data.name || 'Candidate').toUpperCase();
    const contact = String(data.contact || '').replace(/\s+\|/g, ' | ').replace(/\s{2,}/g, ' ').trim();

    doc.y = margin;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(palette.text).text(name, margin, doc.y, {
      width: contentWidth,
    });
    if (contact) {
      doc.font('Helvetica').fontSize(8.5).fillColor(palette.muted).text(contact, margin, doc.y + 2, {
        width: contentWidth,
      });
    }
    doc.moveDown(0.4);
    drawRule();
  };

  const drawSectionTitle = (title) => {
    if (!ensureSpace(22)) {
      return false;
    }
    doc.font('Helvetica-Bold').fontSize(typography.section).fillColor(palette.text).text(title.toUpperCase(), margin, doc.y, {
      width: contentWidth,
    });
    doc.moveDown(0.2);
    doc.strokeColor(palette.rule).lineWidth(0.9).moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).stroke();
    doc.moveDown(0.45);
    return true;
  };

  const drawParagraph = (text) => {
    if (!text) {
      return;
    }
    doc.font('Helvetica').fontSize(typography.body).fillColor(palette.text);
    const height = doc.heightOfString(text, { width: contentWidth, lineGap: typography.lineGap });
    if (!ensureSpace(height + 6)) {
      return;
    }
    doc.text(text, margin, doc.y, { width: contentWidth, lineGap: typography.lineGap });
    doc.moveDown(0.4);
  };

  const drawBullets = (items) => {
    for (const item of items) {
      const text = `- ${item}`;
      doc.font('Helvetica').fontSize(typography.body).fillColor(palette.text);
      const height = doc.heightOfString(text, { width: contentWidth, lineGap: typography.lineGap });
      if (!ensureSpace(height + 6)) {
        return;
      }
      doc.text(text, margin, doc.y, { width: contentWidth, lineGap: typography.lineGap });
      doc.moveDown(0.2);
    }
    doc.moveDown(0.5);
  };

  const drawProjectBullets = (items) => {
    for (const item of items) {
      const trimmed = String(item || '').trim();
      if (!trimmed) {
        continue;
      }

      const parts = trimmed.split(':');
      const hasTitle = parts.length > 1;
      const title = hasTitle ? parts.shift().trim() : '';
      const rest = hasTitle ? parts.join(':').trim() : trimmed;
      const lineText = hasTitle ? `- ${title}: ${rest}` : `- ${rest}`;

      doc.font('Helvetica').fontSize(typography.body).fillColor(palette.text);
      const height = doc.heightOfString(lineText, { width: contentWidth, lineGap: typography.lineGap });
      if (!ensureSpace(height + 6)) {
        return;
      }

      if (hasTitle) {
        doc.font('Helvetica-Bold').fontSize(typography.body).fillColor(palette.text).text(`- ${title}: `, margin, doc.y, {
          continued: true,
          width: contentWidth,
        });
        doc.font('Helvetica').fontSize(typography.body).fillColor(palette.text).text(rest, {
          width: contentWidth,
          lineGap: typography.lineGap,
        });
      } else {
        doc.font('Helvetica').fontSize(typography.body).fillColor(palette.text).text(lineText, margin, doc.y, {
          width: contentWidth,
          lineGap: typography.lineGap,
        });
      }

      doc.moveDown(0.2);
    }
    doc.moveDown(0.5);
  };

  const SKILL_GROUPS = [
    { label: 'Languages', keys: ['python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'c', 'go', 'ruby', 'sql', 'html', 'css'] },
    { label: 'Testing', keys: ['selenium', 'pytest', 'junit', 'testng', 'rest assured', 'cypress', 'playwright', 'jest', 'mocha', 'chai', 'postman', 'api testing', 'test automation', 'performance', 'load testing', 'sdet'] },
    { label: 'Tools & DevOps', keys: ['git', 'github', 'docker', 'kubernetes', 'jenkins', 'ci/cd', 'github actions', 'aws', 'gcp', 'azure', 'linux', 'bash', 'terraform', 'ansible'] },
    { label: 'Core Tech', keys: [] },
  ];

  const normalizeSkill = (skill) => String(skill || '').toLowerCase();

  const resolveSkillGroup = (skill) => {
    const normalized = normalizeSkill(skill);
    if (!normalized) {
      return 'Core Tech';
    }

    for (const group of SKILL_GROUPS) {
      if (group.keys.length === 0) {
        continue;
      }

      const matched = group.keys.some((key) => normalized.includes(key));
      if (matched) {
        return group.label;
      }
    }

    return 'Core Tech';
  };

  const groupSkills = (items) => {
    const grouped = {};
    SKILL_GROUPS.forEach((group) => {
      grouped[group.label] = [];
    });

    items.forEach((skill) => {
      const label = resolveSkillGroup(skill);
      grouped[label].push(skill);
    });

    return grouped;
  };

  const drawSkillLine = (label, items) => {
    const text = items.join(', ');
    if (!text) {
      return;
    }

    doc.font('Helvetica-Bold').fontSize(typography.body).fillColor(palette.text).text(`${label}: `, margin, doc.y, {
      continued: true,
      width: contentWidth,
    });
    doc.font('Helvetica').fontSize(typography.body).fillColor(palette.text).text(text, {
      width: contentWidth,
      lineGap: typography.lineGap,
    });
    doc.moveDown(0.15);
  };

  const drawSkills = (items) => {
    const trimmed = items.filter(Boolean).slice(0, limits.skills);
    if (trimmed.length === 0) {
      return;
    }

    const grouped = groupSkills(trimmed);
    for (const group of SKILL_GROUPS) {
      const groupItems = grouped[group.label] || [];
      if (groupItems.length === 0) {
        continue;
      }

      const height = doc.heightOfString(groupItems.join(', '), { width: contentWidth, lineGap: typography.lineGap });
      if (!ensureSpace(height + 6)) {
        return;
      }
      drawSkillLine(group.label, groupItems);
    }

    doc.moveDown(0.4);
  };

  const drawSummary = (items) => {
    const trimmed = items.slice(0, limits.summary);
    if (trimmed.length === 0) {
      return;
    }

    drawParagraph(trimmed.join(' '));
  };

  drawHeader();

  if (safeSummary.length > 0) {
    if (drawSectionTitle('Summary')) {
      drawSummary(safeSummary);
    }
  }

  if (drawSectionTitle('Core Skills')) {
    drawSkills(safeSkills);
  }

  if (isFresher) {
    if (safeProjects.length > 0 && drawSectionTitle('Projects')) {
      drawProjectBullets(safeProjects.slice(0, limits.projects));
    }
    if (safeExperience.length > 0 && drawSectionTitle('Experience')) {
      drawBullets(safeExperience.slice(0, limits.experience));
    }
  } else {
    if (safeExperience.length > 0 && drawSectionTitle('Experience')) {
      drawBullets(safeExperience.slice(0, limits.experience));
    }
    if (safeProjects.length > 0 && drawSectionTitle('Projects')) {
      drawProjectBullets(safeProjects.slice(0, limits.projects));
    }
  }

  if (safeEducation.length > 0 && drawSectionTitle('Education')) {
    drawBullets(safeEducation.slice(0, limits.education));
  }

  doc.end();
});
