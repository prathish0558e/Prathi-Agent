import { BottomNav } from '../components/BottomNav';
import { Sparkles, Upload, Download, Wand2, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { runtimeConfig } from '../lib/runtimeConfig';

interface StructuredResumeResult {
  score: number;
  gapReason: string;
  summary: string[];
  skills: string[];
  projects: string[];
  experience: string[];
  missingSkills: string[];
  atsKeywordsAdded: string[];
}

interface ResumeHistoryItem {
  id: string;
  originalFileName: string;
  savedAt: string;
  resumeType: string;
  isActive: boolean;
}

type CandidateLevel = 'fresher' | 'experienced';

const KNOWN_JOB_SKILLS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Express',
  'Python',
  'Java',
  'SQL',
  'PostgreSQL',
  'MongoDB',
  'REST API',
  'GraphQL',
  'AWS',
  'Docker',
  'Kubernetes',
  'Git',
  'CI/CD',
  'Unit Testing',
  'Jest',
  'Security',
  'OAuth',
  'JWT',
  'Redis',
  'Microservices',
  'Linux',
];

export function AIResume() {
  const { profile, email, getGoogleAccessToken } = useAuth();
  const [searchParams] = useSearchParams();
  const [jobDescription, setJobDescription] = useState('');
  const [analysis, setAnalysis] = useState<StructuredResumeResult | null>(null);
  const [addedSkills, setAddedSkills] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [status, setStatus] = useState('');
  const [useForAutoMail, setUseForAutoMail] = useState(true);
  const [history, setHistory] = useState<ResumeHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [sendCompany, setSendCompany] = useState(searchParams.get('company') || 'Hiring Team');
  const [sendHrEmail, setSendHrEmail] = useState(searchParams.get('hrEmail') || 'hr@company.com');
  const [detectedJobSkills, setDetectedJobSkills] = useState<string[]>([]);
  const [candidateLevelManual, setCandidateLevelManual] = useState<CandidateLevel>(
    profile?.experienceLevel === 'Fresher' || profile?.experienceLevel === 'Intern' ? 'fresher' : 'experienced',
  );
  const [autoShorten, setAutoShorten] = useState(false);

  const normalizeSkill = (skill: string) => skill.trim().toLowerCase();

  const JOB_BOARD_DOMAINS_AI = ['remotive.com', 'arbeitnow.com', 'remoteok.com', 'remoteok.io', 'remote.co', 'weworkremotely.com', 'flexjobs.com', 'indeed.com', 'linkedin.com', 'glassdoor.com', 'monster.com', 'ziprecruiter.com', 'adzuna.com', 'boards.greenhouse.io', 'jobs.lever.co', 'apply.workable.com'];
  const isJobBoardEmail = (emailAddr: string) => {
    const domain = emailAddr.split('@')[1]?.toLowerCase() || '';
    return !domain || JOB_BOARD_DOMAINS_AI.some((bd) => domain === bd || domain.endsWith(`.${bd}`));
  };

  const finalSkills = useMemo(() => {
    const merged = [...(analysis?.skills || []), ...addedSkills]
      .map((skill) => skill.trim())
      .filter(Boolean);
    const unique: string[] = [];
    const seen = new Set<string>();

    merged.forEach((skill) => {
      const key = normalizeSkill(skill);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(skill);
      }
    });

    return unique;
  }, [analysis?.skills, addedSkills]);

  const visibleMissingSkills = useMemo(() => {
    if (!analysis) {
      return [];
    }

    const selectedSet = new Set(finalSkills.map(normalizeSkill));
    const unique: string[] = [];
    const seen = new Set<string>();

    analysis.missingSkills.forEach((skill) => {
      const normalized = normalizeSkill(skill);
      if (!normalized || selectedSet.has(normalized) || seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      unique.push(skill.trim());
    });

    return unique;
  }, [analysis, finalSkills]);

  const coverageByDetectedSkills = useMemo(() => {
    const required = detectedJobSkills.map((skill) => skill.trim()).filter(Boolean);
    if (required.length === 0) {
      return {
        matched: 0,
        total: 0,
        percent: 0,
        items: [] as Array<{ skill: string; matched: boolean }>,
      };
    }

    const skillSet = new Set(finalSkills.map(normalizeSkill));
    const items = required.map((skill) => ({
      skill,
      matched: skillSet.has(normalizeSkill(skill)),
    }));
    const matched = items.filter((item) => item.matched).length;
    const percent = Math.round((matched / required.length) * 100);

    return {
      matched,
      total: required.length,
      percent,
      items,
    };
  }, [detectedJobSkills, finalSkills]);

  const estimatedPageFullness = useMemo(() => {
    if (!analysis) {
      return 0;
    }

    const weights = candidateLevelManual === 'fresher'
      ? { summary: 9, skills: 2.8, projects: 7, experience: 5.5, education: 5 }
      : { summary: 8, skills: 2.5, projects: 6, experience: 6.5, education: 4.5 };

    const estimate =
      analysis.summary.length * weights.summary +
      finalSkills.length * weights.skills +
      analysis.projects.length * weights.projects +
      analysis.experience.length * weights.experience +
      2 * weights.education +
      12;

    return Math.min(100, Math.max(20, Math.round(estimate)));
  }, [analysis, candidateLevelManual, finalSkills.length]);

  const addSkillOnce = (skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed) {
      return;
    }

    const exists = finalSkills.some((item) => normalizeSkill(item) === normalizeSkill(trimmed));
    if (exists) {
      return;
    }

    setAddedSkills((prev) => [...prev, trimmed]);
  };

  const removeAddedSkill = (skill: string) => {
    setAddedSkills((prev) => prev.filter((item) => normalizeSkill(item) !== normalizeSkill(skill)));
  };

  const loadResumeHistory = async () => {
    if (!email) {
      setHistory([]);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const response = await fetch(`${runtimeConfig.apiBaseUrl}/resume/history?${new URLSearchParams({ email }).toString()}`, {
        method: 'GET',
      });
      if (!response.ok) {
        setHistory([]);
        return;
      }

      const payload = (await response.json()) as { history: ResumeHistoryItem[] };
      setHistory(Array.isArray(payload.history) ? payload.history : []);
    } catch {
      setHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    const prefilled = [
      `Role: ${searchParams.get('role') || ''}`,
      `Company: ${searchParams.get('company') || ''}`,
      `Location: ${searchParams.get('location') || ''}`,
      `Skills: ${searchParams.get('skills') || ''}`,
      `Salary: ${searchParams.get('salary') || ''}`,
      '',
      'Paste exact job description below for best results.',
    ]
      .filter((line) => !line.endsWith(': '))
      .join('\n');

    setJobDescription(prefilled);

    const seeded = (searchParams.get('skills') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    setDetectedJobSkills(Array.from(new Set(seeded)).slice(0, 14));
  }, [searchParams]);

  useEffect(() => {
    const source = jobDescription.toLowerCase();
    const matched = KNOWN_JOB_SKILLS.filter((skill) => source.includes(skill.toLowerCase()));
    if (matched.length === 0) {
      return;
    }

    setDetectedJobSkills((previous) => Array.from(new Set([...previous, ...matched])).slice(0, 14));
  }, [jobDescription]);

  useEffect(() => {
    void loadResumeHistory();
  }, [email]);

  const handleResumeUpload = async (file: File) => {
    if (!email) {
      setStatus('Login email missing. Re-login and try again.');
      return;
    }

    setStatus('');
    setIsUploading(true);

    const formData = new FormData();
    formData.append('email', email);
    formData.append('resume_file', file);

    try {
      const response = await fetch(`${runtimeConfig.apiBaseUrl}/resume/upload`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.message || 'Resume upload failed.');
        return;
      }

      setStatus(`Resume uploaded: ${payload.resume?.originalFileName || file.name}`);
    } catch {
      setStatus('Resume upload failed due to network issue.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!email) {
      setStatus('Login email missing. Re-login and try again.');
      return;
    }

    setIsAnalyzing(true);
    setStatus('');

    try {
      const response = await fetch(`${runtimeConfig.apiBaseUrl}/ai/resume-tailor-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          useStoredResume: true,
          jobDescription,
          targetRole: searchParams.get('role') || profile?.targetRoles?.[0] || 'Software Engineer',
          company: searchParams.get('company') || '',
          level: candidateLevelManual,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.message || 'AI tailoring failed.');
        return;
      }

      setAnalysis(payload.structured as StructuredResumeResult);
      setAddedSkills([]);
      setStatus('AI tailored resume generated. Add skills if needed, then use Final Step below.');
    } catch {
      setStatus('AI tailoring failed due to network issue.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const buildPdfPayload = () => {
    if (!analysis) {
      return null;
    }

    const mergedSkills = Array.from(new Set([...analysis.skills, ...addedSkills]));
    const shouldShorten = autoShorten && estimatedPageFullness > 90;
    const shortenLimits = candidateLevelManual === 'fresher'
      ? { summary: 2, experience: 3, projects: 3 }
      : { summary: 3, experience: 5, projects: 4 };

    return {
      name: profile?.fullName || 'Candidate',
      contact: `${email || ''} | ${profile?.phoneCountryCode || ''} ${profile?.phone || ''}`,
      targetRole: searchParams.get('role') || profile?.targetRoles?.[0] || 'Software Engineer',
      company: searchParams.get('company') || 'Target Company',
      candidateLevel: candidateLevelManual,
      summary: shouldShorten ? analysis.summary.slice(0, shortenLimits.summary) : analysis.summary,
      skills: mergedSkills,
      projects: shouldShorten ? analysis.projects.slice(0, shortenLimits.projects) : analysis.projects,
      experience: shouldShorten ? analysis.experience.slice(0, shortenLimits.experience) : analysis.experience,
      education: [],
      missingSkills: analysis.missingSkills,
      score: analysis.score,
      gapReason: analysis.gapReason,
    };
  };

  const createResumePdfBlob = async () => {
    const payload = buildPdfPayload();
    if (!payload) {
      return null;
    }

    const response = await fetch(`${runtimeConfig.apiBaseUrl}/ai/resume-tailor-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    return response.blob();
  };

  const blobToBase64 = async (blob: Blob) => {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  };

  const handleDownloadPdf = async () => {
    const blob = await createResumePdfBlob();
    if (!blob) {
      setStatus('Unable to download PDF right now.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Optimized_Resume.pdf';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const sendJobMailNow = async () => {
    if (!email) {
      return { ok: false, message: 'Email missing. Re-login and retry.' };
    }

    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return {
        ok: false,
        message: 'Google mail access token missing. Logout and login again with Google consent.',
      };
    }

    const role = searchParams.get('role') || profile?.targetRoles?.[0] || 'Software Engineer';
    const company = sendCompany || searchParams.get('company') || 'Hiring Team';
    const hrEmail = sendHrEmail || searchParams.get('hrEmail') || 'hr@company.com';
    const selectedTopSkills = analysis ? Array.from(new Set([...analysis.skills, ...addedSkills])).slice(0, 6) : [];

    const response = await fetch(`${runtimeConfig.apiBaseUrl}/email/send-job-application`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken,
        to: hrEmail,
        subject: `Application for ${role} - ${profile?.fullName || 'Candidate'}`,
        body: [
          `Hi Hiring Team at ${company},`,
          '',
          `I am applying for the ${role} role and attaching my tailored resume for this requirement.`,
          `Core skills aligned to this job: ${selectedTopSkills.join(', ') || 'Please see attached tailored resume'}.`,
          '',
          'Thank you for your time and consideration.',
          '',
          'Kind regards,',
          profile?.fullName || email,
        ].join('\n'),
        userEmail: email,
      }),
    });

    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      return { ok: false, message: details.message || 'Failed to send HR mail with tailored resume.' };
    }

    return { ok: true, message: 'Tailored resume mail sent successfully.' };
  };

  const handleActivateForMail = async (sendNow = false) => {
    if (!email || !analysis) {
      setStatus('Email or analysis missing. Generate resume again and retry.');
      return;
    }

    setIsActivating(true);

    try {
      const blob = await createResumePdfBlob();
      if (!blob) {
        setStatus('Unable to generate tailored PDF for activation.');
        return;
      }

      const base64Pdf = await blobToBase64(blob);
      const role = searchParams.get('role') || profile?.targetRoles?.[0] || 'Software Engineer';
      const company = searchParams.get('company') || 'Company';

      const activateResponse = await fetch(`${runtimeConfig.apiBaseUrl}/resume/activate-generated`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          fileName: `Tailored_${company.replace(/\s+/g, '_')}_${role.replace(/\s+/g, '_')}.pdf`,
          base64Pdf,
          extractedText: [analysis.summary.join(' '), analysis.experience.join(' '), analysis.projects.join(' ')].join(' '),
        }),
      });

      if (!activateResponse.ok) {
        const details = await activateResponse.json().catch(() => ({}));
        setStatus(details.message || 'Unable to activate tailored resume for mail.');
        return;
      }

      if (sendNow) {
        const sendNowResult = await sendJobMailNow();
        if (!sendNowResult.ok) {
          setStatus(`Resume activated. Mail not sent: ${sendNowResult.message}`);
          return;
        }
      }

      if (useForAutoMail) {
        setStatus('Tailored resume set as active. All upcoming manual/auto HR mails will use this resume.');
      } else {
        setStatus('Tailored resume activated for current mail flow.');
      }

      await loadResumeHistory();
    } catch {
      setStatus('Activation failed due to network/server issue.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleUndoPreviousResume = async () => {
    if (!email) {
      setStatus('Email missing. Re-login and retry.');
      return;
    }

    try {
      const response = await fetch(`${runtimeConfig.apiBaseUrl}/resume/undo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.message || 'Unable to restore previous resume version.');
        return;
      }

      setStatus(payload.message || 'Previous resume restored.');
      await loadResumeHistory();
    } catch {
      setStatus('Failed to undo resume due to network issue.');
    }
  };

  const handleActivateHistoryItem = async (resumeId: string) => {
    if (!email) {
      setStatus('Email missing. Re-login and retry.');
      return;
    }

    try {
      const response = await fetch(`${runtimeConfig.apiBaseUrl}/resume/activate-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, resumeId }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.message || 'Unable to activate selected resume version.');
        return;
      }

      setStatus(payload.message || 'Selected resume version is now active.');
      await loadResumeHistory();
    } catch {
      setStatus('Failed to activate selected resume version.');
    }
  };

  return (
    <div className="app-shell pb-24">
      <div className="relative max-w-md mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wide">PROFESSIONAL AI RESUME ENGINE</span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-1">
            Resume Optimizer
          </h1>
          <p className="text-xs text-muted-foreground">ATS and missing-skills are screen insights only. Final PDF stays clean and professional.</p>
        </div>

        <div className="bg-slate-900/90 border border-cyan-300/30 rounded-xl p-4 mb-4">
          <p className="text-xs text-cyan-200 font-semibold mb-2">Layout Mode</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCandidateLevelManual('fresher')}
              className={`rounded-lg py-2 text-xs border ${
                candidateLevelManual === 'fresher'
                  ? 'bg-cyan-500/20 border-cyan-300/40 text-cyan-100'
                  : 'bg-slate-900/70 border-slate-700 text-slate-300'
              }`}
            >
              Fresher (One-page)
            </button>
            <button
              onClick={() => setCandidateLevelManual('experienced')}
              className={`rounded-lg py-2 text-xs border ${
                candidateLevelManual === 'experienced'
                  ? 'bg-cyan-500/20 border-cyan-300/40 text-cyan-100'
                  : 'bg-slate-900/70 border-slate-700 text-slate-300'
              }`}
            >
              Experienced
            </button>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-cyan-300/30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-cyan-100">Resume Versions</p>
            <button
              onClick={() => {
                void handleUndoPreviousResume();
              }}
              className="text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-lg text-slate-200"
            >
              Undo to Previous
            </button>
          </div>

          {isHistoryLoading ? <p className="text-xs text-slate-400">Loading history...</p> : null}
          {!isHistoryLoading && history.length === 0 ? <p className="text-xs text-slate-400">No resume versions yet.</p> : null}
          <div className="space-y-2">
            {history.slice(0, 5).map((item) => (
              <div key={item.id} className="bg-slate-950/70 border border-slate-700 rounded-lg p-2">
                <p className="text-xs text-slate-100 truncate">{item.originalFileName}</p>
                <p className="text-[11px] text-slate-400">{new Date(item.savedAt).toLocaleString()} • {item.resumeType}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-[11px] ${item.isActive ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {!item.isActive ? (
                    <button
                      onClick={() => {
                        void handleActivateHistoryItem(item.id);
                      }}
                      className="text-[11px] bg-cyan-500/20 border border-cyan-300/40 px-2 py-1 rounded text-cyan-100"
                    >
                      Make Active
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-cyan-300/30 rounded-xl p-4 mb-4">
          <label className="text-sm font-semibold mb-2 block">Upload Master Resume (PDF)</label>
          <label className="w-full border border-dashed border-cyan-300/40 rounded-lg p-4 block cursor-pointer hover:border-cyan-300/70 transition-all">
            <input
              type="file"
              className="hidden"
              accept="application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleResumeUpload(file);
                }
              }}
            />
            <div className="flex items-center gap-2 text-sm text-cyan-100">
              <Upload className="w-4 h-4" />
              {isUploading ? 'Uploading...' : 'Tap to upload PDF resume'}
            </div>
          </label>
        </div>

        <div className="bg-slate-900/90 border border-cyan-300/30 rounded-xl p-4 mb-4">
          <label className="text-sm font-semibold mb-2 block">Job Description</label>
          <textarea
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            className="w-full h-48 bg-slate-950/70 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400"
          />
          <button onClick={() => {
            void handleAnalyze();
          }} disabled={isAnalyzing} className="w-full mt-3 bg-gradient-to-r from-[#00D1FF] to-cyan-500 text-slate-950 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
            <Wand2 className="w-4 h-4" />
            {isAnalyzing ? 'Analyzing...' : 'Generate Professional Resume'}
          </button>
        </div>

        {status ? <p className="text-xs text-primary mb-3">{status}</p> : null}

        {analysis ? (
          <div className="space-y-4 mb-6">

            {/* ── Analysis Header: Candidate + ATS Score ── */}
            <div className="bg-slate-900/90 border border-emerald-400/30 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-base font-bold text-white tracking-wide truncate">{profile?.fullName || 'Candidate'}</p>
                  <p className="text-xs text-cyan-300 font-semibold">{searchParams.get('role') || profile?.targetRoles?.[0] || 'Software Engineer'}</p>
                  {sendCompany && sendCompany !== 'Hiring Team' ? (
                    <p className="text-[11px] text-slate-400 mt-0.5">Targeting: {sendCompany}</p>
                  ) : null}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-4xl font-black text-emerald-300 leading-none">{analysis.score}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">ATS Score</p>
                </div>
              </div>
              <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-400/20 rounded-lg px-3 py-2 leading-relaxed">
                {analysis.gapReason}
              </p>
            </div>

            {/* ── One-page Fill Meter ── */}
            <div className="bg-slate-900/90 border border-cyan-300/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-cyan-200 uppercase tracking-wider">One-page Fill Meter</p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoShorten}
                      onChange={(event) => setAutoShorten(event.target.checked)}
                      className="w-3.5 h-3.5 accent-cyan-400"
                    />
                    Auto-trim bullets
                  </label>
                  <span className={`text-sm font-black ${
                    estimatedPageFullness > 95 ? 'text-red-400' : estimatedPageFullness > 85 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {estimatedPageFullness}%
                  </span>
                </div>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    estimatedPageFullness > 95 ? 'bg-red-500' : estimatedPageFullness > 85 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${estimatedPageFullness}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">
                {candidateLevelManual === 'fresher' ? 'Fresher: strict one-page output.' : 'Experienced: dense professional layout.'}
                {autoShorten && estimatedPageFullness > 90 ? ' · Auto-trim ON — bullets compressed in PDF.' : ''}
              </p>
            </div>

            {/* ── ATS Keyword Coverage ── */}
            {coverageByDetectedSkills.total > 0 ? (
              <div className="bg-slate-900/90 border border-cyan-300/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-cyan-200 uppercase tracking-wider">ATS Keyword Coverage</p>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    coverageByDetectedSkills.percent >= 75
                      ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'
                      : 'bg-amber-500/15 border-amber-400/30 text-amber-200'
                  }`}>
                    {coverageByDetectedSkills.matched}/{coverageByDetectedSkills.total} · {coverageByDetectedSkills.percent}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {coverageByDetectedSkills.items.map((item) => (
                    <span
                      key={`cov-${item.skill}`}
                      className={`text-[11px] px-2.5 py-1 rounded-full border ${
                        item.matched
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                          : 'bg-slate-800 border-slate-600 text-slate-400'
                      }`}
                    >
                      {item.matched ? '✓ ' : ''}{item.skill}
                    </span>
                  ))}
                </div>
                {coverageByDetectedSkills.percent < 75 ? (
                  <p className="text-[11px] text-amber-300 mt-2.5 bg-amber-500/10 border border-amber-400/20 rounded-lg px-2.5 py-1.5">
                    Target 75% — add {Math.max(0, Math.ceil(coverageByDetectedSkills.total * 0.75) - coverageByDetectedSkills.matched)} more required skill(s) below.
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* ── Skills Management ── */}
            <div className="bg-slate-900/90 border border-cyan-300/20 rounded-xl p-4 space-y-4">
              <p className="text-xs font-bold text-cyan-200 uppercase tracking-wider">Skills Management</p>

              {detectedJobSkills.length > 0 ? (
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">Job Required Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedJobSkills.map((skill) => {
                      const isAdded = finalSkills.some((s) => normalizeSkill(s) === normalizeSkill(skill));
                      return isAdded ? (
                        <span
                          key={`req-${skill}`}
                          className="text-[11px] bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 rounded-full px-2.5 py-1 flex items-center gap-1"
                        >
                          ✓ {skill}
                        </span>
                      ) : (
                        <button
                          key={`req-${skill}`}
                          onClick={() => { addSkillOnce(skill); }}
                          className="text-[11px] bg-slate-800 border border-cyan-400/30 text-cyan-200 rounded-full px-2.5 py-1 hover:bg-cyan-500/15 active:scale-95 transition-all"
                        >
                          + {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">Paste Job Description above to auto-detect required skills.</p>
              )}

              {visibleMissingSkills.length > 0 ? (
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">AI Suggested Missing</p>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleMissingSkills.map((skill) => (
                      <button
                        key={`miss-${skill}`}
                        onClick={() => { addSkillOnce(skill); }}
                        className="text-[11px] bg-slate-800 border border-slate-600 text-slate-300 rounded-full px-2.5 py-1 hover:bg-slate-700 active:scale-95 transition-all"
                      >
                        + {skill}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {addedSkills.length > 0 ? (
                <div>
                  <p className="text-[11px] text-emerald-400 font-semibold mb-2 uppercase tracking-wide">Added by You ({addedSkills.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {addedSkills.map((skill) => (
                      <button
                        key={`added-${skill}`}
                        onClick={() => { removeAddedSkill(skill); }}
                        className="text-[11px] bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 rounded-full px-2.5 py-1 flex items-center gap-1.5 hover:bg-red-500/15 hover:border-red-400/30 hover:text-red-300 transition-all"
                      >
                        ✓ {skill} <span className="opacity-70">×</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* ── Resume Content Preview ── */}
            <div className="bg-slate-900/90 border border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-slate-800/70 px-4 py-2.5 border-b border-slate-700">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Resume Content Preview</p>
              </div>
              <div className="p-4 space-y-5">

                <div>
                  <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 pb-1.5 border-b border-slate-700/70">Professional Summary</p>
                  <ul className="space-y-2">
                    {analysis.summary.map((line, index) => (
                      <li key={index} className="text-[12px] text-slate-200 flex gap-2 leading-relaxed">
                        <span className="text-cyan-500 flex-shrink-0 mt-0.5">▸</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 pb-1.5 border-b border-slate-700/70">Core Skills ({finalSkills.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {finalSkills.map((skill, index) => (
                      <span
                        key={index}
                        className={`text-[11px] px-2 py-0.5 rounded border ${
                          addedSkills.some((a) => normalizeSkill(a) === normalizeSkill(skill))
                            ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                            : 'bg-slate-800 border-slate-600 text-slate-300'
                        }`}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {analysis.experience.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 pb-1.5 border-b border-slate-700/70">Experience</p>
                    <ul className="space-y-2">
                      {analysis.experience.map((line, index) => (
                        <li key={index} className="text-[12px] text-slate-200 flex gap-2 leading-relaxed">
                          <span className="text-slate-500 flex-shrink-0 mt-0.5">▸</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {analysis.projects.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 pb-1.5 border-b border-slate-700/70">Projects</p>
                    <ul className="space-y-2">
                      {analysis.projects.map((line, index) => (
                        <li key={index} className="text-[12px] text-slate-200 flex gap-2 leading-relaxed">
                          <span className="text-emerald-500 flex-shrink-0 mt-0.5">▸</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {analysis.atsKeywordsAdded.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1.5 pb-1.5 border-b border-slate-700/70">ATS Keywords Injected</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{analysis.atsKeywordsAdded.join(' · ')}</p>
                  </div>
                ) : null}

              </div>
            </div>

            {/* ── Download PDF ── */}
            <button
              onClick={() => { void handleDownloadPdf(); }}
              className="w-full bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Download Optimized PDF
            </button>

            {/* ── Final Step: Gates + Activate + Send ── */}
            <div className="bg-slate-900/90 border border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-slate-800/70 px-4 py-2.5 border-b border-slate-700 flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-cyan-300" />
                <p className="text-xs font-black text-white uppercase tracking-widest">Final Step — Activate & Send</p>
              </div>
              <div className="p-4 space-y-3">

                {/* Gate 1: Hard Stop — page overflow */}
                {estimatedPageFullness > 95 && !autoShorten ? (
                  <div className="bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2.5 text-[11px] text-red-300 leading-relaxed">
                    ⛔ <strong>Hard Stop:</strong> Resume overflows one page ({estimatedPageFullness}%). Enable <em>Auto-trim bullets</em> in the meter above, or remove some skills/bullets first.
                  </div>
                ) : null}

                {/* Gate 2: ATS coverage warning */}
                {coverageByDetectedSkills.total > 0 && coverageByDetectedSkills.percent < 75 ? (
                  <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2.5 text-[11px] text-amber-300 leading-relaxed">
                    ⚠ ATS coverage is only <strong>{coverageByDetectedSkills.percent}%</strong> (minimum 75% recommended). Add more required skills above before sending.
                  </div>
                ) : null}

                <input
                  value={sendCompany}
                  onChange={(event) => setSendCompany(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 outline-none"
                  placeholder="Company name"
                />
                <div>
                  <input
                    value={sendHrEmail}
                    onChange={(event) => setSendHrEmail(event.target.value)}
                    className={`w-full bg-slate-800 rounded-lg px-3 py-2 text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                      sendHrEmail && isJobBoardEmail(sendHrEmail)
                        ? 'border border-amber-400/50 text-amber-200'
                        : 'border border-slate-600 text-slate-100 focus:border-cyan-400'
                    }`}
                    placeholder="hr@company.com"
                  />
                  {sendHrEmail && isJobBoardEmail(sendHrEmail) ? (
                    <p className="text-[11px] text-amber-300 mt-1.5 bg-amber-500/10 border border-amber-400/20 rounded px-2 py-1.5 leading-relaxed">
                      ⚠ This looks like a job board email, not a real HR contact. Enter the company’s direct HR email, or apply via the job posting link.
                    </p>
                  ) : null}
                </div>

                <label className="flex items-center gap-2 text-xs text-cyan-100 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useForAutoMail}
                    onChange={(event) => setUseForAutoMail(event.target.checked)}
                    className="w-3.5 h-3.5 accent-cyan-400"
                  />
                  Use for upcoming auto HR mails
                </label>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => { void handleActivateForMail(false); }}
                    disabled={isActivating}
                    className="bg-slate-800 border border-slate-600 rounded-lg py-2.5 text-xs text-slate-200 font-semibold disabled:opacity-50"
                  >
                    {isActivating ? 'Applying...' : 'Set Active Only'}
                  </button>
                  <button
                    onClick={() => { void handleActivateForMail(true); }}
                    disabled={isActivating || (estimatedPageFullness > 95 && !autoShorten) || isJobBoardEmail(sendHrEmail)}
                    className="bg-gradient-to-r from-emerald-400 to-green-400 text-slate-950 rounded-lg py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isActivating ? 'Sending...' : 'Set Active + Send'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        ) : null}

        <div className="text-xs text-slate-400 bg-slate-900/60 border border-slate-700 rounded-xl p-3">
          <p className="font-semibold text-slate-200 mb-1">Pipeline</p>
          <p>1. Upload PDF -&gt; backend storage</p>
          <p>2. AI strict JSON tailoring</p>
          <p>3. Download production-style optimized PDF</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
