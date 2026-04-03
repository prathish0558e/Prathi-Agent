import { BottomNav } from '../components/BottomNav';
import { JobCardAdvanced } from '../components/JobCardAdvanced';
import { QuickProfileMenu } from '../components/QuickProfileMenu';
import { Search, Filter, Shield, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { JobOpportunity } from '../types/careerAgent';
import { runtimeConfig } from '../lib/runtimeConfig';
import { useAuth } from '../auth/AuthContext';

const JOB_CACHE_KEY = 'career_agent_last_jobs_feed';
const JOB_ALERTS_ENABLED_KEY = 'career_agent_job_alerts_enabled';
const KNOWN_JOB_IDS_KEY = 'career_agent_known_job_ids';

export function Jobs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, email, getGoogleAccessToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [applyableOnly, setApplyableOnly] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedType, setSelectedType] = useState<'all' | JobOpportunity['type']>('all');
  const [minMatch, setMinMatch] = useState(0);
  const [autoMailEnabled, setAutoMailEnabled] = useState(profile?.wantsMailAutomation ?? false);
  const [mailStatus, setMailStatus] = useState('');
  const mailStatusTimerRef = useRef<number | null>(null);

  const showMailStatus = (message: string) => {
    setMailStatus(message);
    if (mailStatusTimerRef.current) {
      window.clearTimeout(mailStatusTimerRef.current);
    }
    mailStatusTimerRef.current = window.setTimeout(() => {
      setMailStatus('');
    }, 6000);
  };
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveData, setIsLiveData] = useState(false);
  const [feedTime, setFeedTime] = useState<string | null>(null);
  const [providerSummary, setProviderSummary] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState<JobOpportunity[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [jobAlertsEnabled, setJobAlertsEnabled] = useState(false);
  const hasInitializedAlertsRef = useRef(false);

  const normalizeTokens = (values: string[] = []) =>
    values.map((value) => value.trim().toLowerCase()).filter(Boolean);

  const buildProfileQuery = () => {
    const roleTokens = normalizeTokens(profile?.targetRoles || []);
    const skillTokens = normalizeTokens(profile?.primarySkills || []);
    const terms = [...roleTokens.slice(0, 2), ...skillTokens.slice(0, 2)].filter(Boolean);
    return terms.join(' ').trim() || 'software developer';
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const incoming = params.get('q');
    if (incoming !== null) {
      setSearchQuery(incoming.trim());
    }
  }, [location.search]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = localStorage.getItem(JOB_ALERTS_ENABLED_KEY);
    setJobAlertsEnabled(stored === 'true');

    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const updateKnownJobIds = (nextJobs: JobOpportunity[]) => {
    const ids = nextJobs.map((job) => String(job.id));
    localStorage.setItem(KNOWN_JOB_IDS_KEY, JSON.stringify(ids));
  };

  const getKnownIds = (): Set<string> => {
    const knownRaw = localStorage.getItem(KNOWN_JOB_IDS_KEY);
    const knownIds = new Set<string>();
    if (knownRaw) {
      try {
        const parsed = JSON.parse(knownRaw) as string[];
        parsed.forEach((id) => knownIds.add(String(id)));
      } catch {
        // Ignore
      }
    }
    return knownIds;
  };

  // Tags each job with isNew=true if it wasn't seen in the previous feed load.
  const tagNewJobs = (nextJobs: JobOpportunity[]): JobOpportunity[] => {
    if (!hasInitializedAlertsRef.current) {
      // First load — nothing is "new" yet; just record IDs
      return nextJobs.map((job) => ({ ...job, isNew: false }));
    }
    const knownIds = getKnownIds();
    return nextJobs.map((job) => ({
      ...job,
      isNew: !knownIds.has(String(job.id)),
    }));
  };

  const notifyNewJobsIfAny = (nextJobs: JobOpportunity[]) => {
    const knownIds = getKnownIds();

    if (!hasInitializedAlertsRef.current) {
      hasInitializedAlertsRef.current = true;
      updateKnownJobIds(nextJobs);
      return;
    }

    const freshJobs = nextJobs.filter((job) => !knownIds.has(String(job.id))).slice(0, 3);
    if (freshJobs.length > 0) {
      if (jobAlertsEnabled && notificationPermission === 'granted') {
        freshJobs.forEach((job) => {
          new Notification(`New ${job.role} opening`, {
            body: `${job.company} • ${job.location}`,
            tag: `career-agent-${job.id}`,
          });
        });
      }

    }

    updateKnownJobIds(nextJobs);
  };

  const toggleJobAlerts = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showMailStatus('Notifications are not supported in this browser.');
      return;
    }

    if (!jobAlertsEnabled) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') {
        showMailStatus('Notification permission denied. Enable browser notifications for job alerts.');
        return;
      }

      setJobAlertsEnabled(true);
      localStorage.setItem(JOB_ALERTS_ENABLED_KEY, 'true');
      showMailStatus('Job alerts enabled. New jobs will show notifications.');
      return;
    }

    setJobAlertsEnabled(false);
    localStorage.setItem(JOB_ALERTS_ENABLED_KEY, 'false');
      showMailStatus('Job alerts turned off.');
  };

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setError('');

        const dedupeJobs = (items: JobOpportunity[]) => {
          const seen = new Set<string>();
          return items.filter((job) => {
            const key = `${String(job.id)}|${job.applyUrl || ''}|${job.company}|${job.role}`.toLowerCase();
            if (seen.has(key)) {
              return false;
            }

            seen.add(key);
            return true;
          });
        };

        const buildQueryParams = (includeProfileFilters: boolean, includeCountry: boolean) => {
          const params = new URLSearchParams({
            query: searchQuery.trim() || buildProfileQuery(),
            limit: '220',
            deep: 'true',
          });

          if (includeCountry) {
            const preferredCountry = profile?.preferredCountryName || profile?.preferredCountryCode || '';
            if (preferredCountry) {
              params.set('country', preferredCountry);
            }
          }

          if (includeProfileFilters) {
            if (profile?.experienceLevel) {
              params.set('experienceLevel', profile.experienceLevel);
            }

            if (typeof profile?.yearsOfExperience === 'number') {
              params.set('experienceYears', String(profile.yearsOfExperience));
            }
          }

          return params;
        };

        const queryParams = buildQueryParams(true, true);

        const fetchPayload = async (
          path: '/jobs/feed' | '/jobs/local-feed',
          params: URLSearchParams,
        ) => {
          const response = await fetch(`${runtimeConfig.apiBaseUrl}${path}?${params.toString()}`, {
            method: 'GET',
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error('Unable to load live jobs right now.');
          }

          return (await response.json()) as {
            jobs: JobOpportunity[];
            fetchedAt?: string;
            providerSummary?: Record<string, unknown>;
          };
        };

        let payload = await fetchPayload('/jobs/feed', queryParams);
        let expandedSearchApplied = false;

        if (!Array.isArray(payload.jobs) || payload.jobs.length < 30) {
          const relaxedPayload = await fetchPayload('/jobs/feed', buildQueryParams(false, true));
          const mergedJobs = dedupeJobs([...(payload.jobs || []), ...(relaxedPayload.jobs || [])]);

          payload = {
            ...relaxedPayload,
            jobs: mergedJobs,
            fetchedAt: relaxedPayload.fetchedAt ?? payload.fetchedAt,
            providerSummary: relaxedPayload.providerSummary ?? payload.providerSummary,
          };

          expandedSearchApplied = true;
        }

        if (!Array.isArray(payload.jobs) || payload.jobs.length < 50) {
          const preferredCity = (profile?.preferredLocations || []).find((item) => String(item || '').trim().length > 0);
          if (preferredCity) {
            const localParams = new URLSearchParams({
              city: preferredCity,
              keyword: searchQuery.trim() || 'software developer',
              limit: '200',
              deep: 'true',
            });

            const localPayload = await fetchPayload('/jobs/local-feed', localParams);
            payload = {
              ...payload,
              jobs: dedupeJobs([...(payload.jobs || []), ...(localPayload.jobs || [])]),
              fetchedAt: payload.fetchedAt ?? localPayload.fetchedAt,
              providerSummary: payload.providerSummary ?? localPayload.providerSummary,
            };
            expandedSearchApplied = true;
          }
        }

        if (payload.jobs.length < 80) {
          const globalPayload = await fetchPayload('/jobs/feed', buildQueryParams(false, false));
          payload = {
            ...payload,
            jobs: dedupeJobs([...(payload.jobs || []), ...(globalPayload.jobs || [])]),
            fetchedAt: payload.fetchedAt ?? globalPayload.fetchedAt,
            providerSummary: payload.providerSummary ?? globalPayload.providerSummary,
          };
          expandedSearchApplied = true;
        }

        const nextJobs = payload.jobs;
        const taggedJobs = tagNewJobs(nextJobs);
        notifyNewJobsIfAny(nextJobs);
        hasInitializedAlertsRef.current = true;
        setJobs(taggedJobs);
        if (taggedJobs.length > 0) {
          localStorage.setItem(JOB_CACHE_KEY, JSON.stringify(taggedJobs));
        }
        updateKnownJobIds(nextJobs);
        setIsLiveData(payload.jobs.length > 0);
        setFeedTime(payload.fetchedAt ?? null);
        setProviderSummary(payload.providerSummary ?? null);
        if (expandedSearchApplied && payload.jobs.length > 0) {
          setError('Expanded search mode enabled to maximize global + local opportunities.');
        }
      } catch {
        const cached = localStorage.getItem(JOB_CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as JobOpportunity[];
            setJobs(parsed);
            setIsLiveData(false);
            setError('Live job feed unavailable. Showing last synced jobs from cache.');
          } catch {
            setJobs([]);
            setIsLiveData(false);
            setError('Live job feed unavailable. Please retry.');
          }
        } else {
          setJobs([]);
          setIsLiveData(false);
          setError('Live job feed unavailable. Please retry.');
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    jobAlertsEnabled,
    notificationPermission,
    profile?.experienceLevel,
    profile?.yearsOfExperience,
    profile?.preferredCountryCode,
    profile?.preferredCountryName,
    profile?.primarySkills,
    profile?.targetRoles,
    searchQuery,
  ]);

  useEffect(() => {
    const cached = localStorage.getItem(JOB_CACHE_KEY);
    if (!cached) {
      return;
    }

    try {
      const parsed = JSON.parse(cached) as JobOpportunity[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setJobs(parsed);
      }
    } catch {
      // Ignore invalid cache
    }
  }, []);

  const filteredJobs = useMemo(() => {
    const roleTokens = normalizeTokens(profile?.targetRoles || []);
    const skillTokens = normalizeTokens(profile?.primarySkills || []);
    let result = jobs
      .filter((job) => (verifiedOnly ? job.verified : true))
      .filter((job) => (applyableOnly ? Boolean(job.applyUrl) : true))
      .filter((job) => (remoteOnly ? job.type === 'Remote' || job.location.toLowerCase().includes('remote') : true))
      .filter((job) => (selectedType === 'all' ? true : job.type === selectedType))
      .filter((job) => job.matchPercentage >= minMatch);

    const baseResult = result;

    if (!searchQuery.trim() && (roleTokens.length > 0 || skillTokens.length > 0)) {
      result = result.filter((job) => {
        const text = `${job.role} ${job.company} ${(job.tags || []).join(' ')}`.toLowerCase();
        const roleMatch = roleTokens.length > 0 && roleTokens.some((term) => text.includes(term));
        const skillMatch = skillTokens.length > 0 && skillTokens.some((term) => text.includes(term));
        return roleMatch || skillMatch;
      });

      if (baseResult.length >= 20 && result.length < 12) {
        result = baseResult;
      }
    }

    // Apply JobRequirements filtering if available
    if (profile?.jobRequirements) {
      const req = profile.jobRequirements;

      // Filter by job types
      if (req.jobTypes && req.jobTypes.length > 0) {
        result = result.filter((job) => {
          const jobType = job.type?.toLowerCase() || '';
          return req.jobTypes.some((type) => {
            const typeMapping: Record<string, string[]> = {
              'full-time': ['full-time', 'permanent'],
              'part-time': ['part-time'],
              contract: ['contract', 'freelance'],
              internship: ['internship'],
              temporary: ['temporary', 'temp'],
            };
            return typeMapping[type]?.some((t) => jobType.includes(t)) ?? false;
          });
        });
      }

      // Filter by target companies (if any specified)
      if (req.targetCompanies && req.targetCompanies.length > 0) {
        result = result.filter((job) =>
          req.targetCompanies.some((company) =>
            job.company.toLowerCase().includes(company.toLowerCase()),
          ),
        );
      }

      // Filter out excluded companies
      if (req.excludeCompanies && req.excludeCompanies.length > 0) {
        result = result.filter(
          (job) =>
            !req.excludeCompanies.some((company) =>
              job.company.toLowerCase().includes(company.toLowerCase()),
            ),
        );
      }

      // Filter by required skills (job should have at least some of them)
      if (req.requiredSkills && req.requiredSkills.length > 0) {
        result = result.filter((job) => {
          const jobDescLower = `${job.role} ${(job.tags || []).join(' ')}`.toLowerCase();
          return req.requiredSkills.some((skill) =>
            jobDescLower.includes(skill.toLowerCase()),
          );
        });
      }

      // Do not collapse the global feed too aggressively when no explicit search is entered.
      // If profile requirements over-narrow the list, fall back to broader base results.
      if (!searchQuery.trim() && baseResult.length >= 20 && result.length < 12) {
        result = baseResult;
      }
    }

    return result;
  }, [
    applyableOnly,
    jobs,
    minMatch,
    remoteOnly,
    searchQuery,
    selectedType,
    verifiedOnly,
    profile?.jobRequirements,
    profile?.primarySkills,
    profile?.targetRoles,
  ]);

  const JOB_BOARD_DOMAINS = ['remotive.com', 'arbeitnow.com', 'remoteok.com', 'remoteok.io', 'remote.co', 'weworkremotely.com', 'flexjobs.com', 'indeed.com', 'linkedin.com', 'glassdoor.com', 'monster.com', 'ziprecruiter.com', 'careerbuilder.com', 'simplyhired.com', 'adzuna.com', 'boards.greenhouse.io', 'jobs.lever.co', 'apply.workable.com', 'jobs.ashbyhq.com', 'job-boards.eu.greenhouse.io', 'job-boards.greenhouse.io', 'themuse.com'];

  const isJobBoardEmail = (emailAddr: string | null | undefined): boolean => {
    if (!emailAddr) return true;
    const domain = emailAddr.split('@')[1]?.toLowerCase() || '';
    return JOB_BOARD_DOMAINS.some((bd) => domain === bd || domain.endsWith(`.${bd}`));
  };

  const isHrEmailActionable = (job: JobOpportunity): boolean => {
    if (!job.hrEmail || isJobBoardEmail(job.hrEmail)) {
      return false;
    }

    const confidence = job.hrEmailConfidence || 0;
    if (job.hrEmailStatus === 'verified') {
      return confidence >= 55;
    }

    return confidence >= 40;
  };

  const requestHrMail = (job: JobOpportunity) => {
    const execute = async () => {
      try {
        if (!isHrEmailActionable(job)) {
          showMailStatus(`No direct HR email available for ${job.company}. Use the "Open Exact Job Posting" link to apply via their careers page.`);
          return;
        }

        if (job.hrEmailStatus !== 'verified') {
          showMailStatus(`Using an unverified HR email guess for ${job.company}. Review before sending.`);
        }

        showMailStatus(`Sending professional application to ${job.company}...`);

        const accessToken = await getGoogleAccessToken();
        if (!accessToken) {
          showMailStatus('Google mail access token missing. Logout and login again with Google consent.');
          return;
        }

        if (!email) {
          showMailStatus('User email missing. Re-login and retry.');
          return;
        }

        const resumeCheck = await fetch(
          `${runtimeConfig.apiBaseUrl}/resume/latest?${new URLSearchParams({ email }).toString()}`,
          { method: 'GET' },
        );
        if (!resumeCheck.ok) {
          showMailStatus('No uploaded PDF resume found. Open AI Resume page, upload PDF, then retry mail send.');
          return;
        }

        const to = job.hrEmail;
        const subject = `Application for ${job.role} - ${profile?.fullName || 'Candidate'}`;
        const body = [
          `Hi Hiring Team at ${job.company},`,
          '',
          `I am writing to express my strong interest in the ${job.role} position.`,
          `I bring focused experience in ${(profile?.primarySkills || []).slice(0, 6).join(', ') || 'relevant technical domains'} with practical project delivery and measurable outcomes.`,
          `Preferred location and work mode: ${profile?.preferredLocations?.[0] || 'Flexible across remote or relocation options'}.`,
          'I would value the opportunity to discuss how my profile aligns with this requirement.',
          '',
          'Please find my uploaded resume attached for your review.',
          '',
          'Kind regards,',
          profile?.fullName || email || 'Candidate',
        ].join('\n');

        const response = await fetch(`${runtimeConfig.apiBaseUrl}/email/send-job-application`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken,
            to,
            subject,
            body,
            userEmail: email,
          }),
        });

        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          if (response.status === 403) {
            showMailStatus(`${details.message || 'Insufficient scopes.'} Please logout and login again with Google consent.`);
          } else if (response.status === 400) {
            showMailStatus(details.message || 'Resume upload missing. Upload PDF in AI Resume page, then retry.');
          } else {
            showMailStatus(details.message || 'Failed to send HR mail.');
          }
          return;
        }

        const successPayload = await response.json().catch(() => ({}));
        const sentTime = successPayload.sentAt ? new Date(successPayload.sentAt).toLocaleTimeString() : 'now';
        const attachmentName = successPayload.attachmentFileName || 'uploaded resume PDF';
        showMailStatus(`Mail sent to ${to} at ${sentTime}. Attachment: ${attachmentName}`);
      } catch {
        showMailStatus('Mail send request failed due to network/server issue. Retry after backend restart.');
      }
    };

    void execute();
  };

  useEffect(() => {
    if (!autoMailEnabled || filteredJobs.length === 0) {
      return;
    }

    const candidateJobs = filteredJobs.filter((job) => job.matchPercentage >= 85 && Boolean(job.applyUrl)).slice(0, 2);
    if (candidateJobs.length === 0) {
      return;
    }

    const alreadySentKey = `career_agent_auto_mail_sent:${new Date().toDateString()}`;
    if (sessionStorage.getItem(alreadySentKey) === 'true') {
      return;
    }

    sessionStorage.setItem(alreadySentKey, 'true');
    candidateJobs.forEach((job) => {
      requestHrMail(job);
    });
  }, [autoMailEnabled, filteredJobs]);

  useEffect(() => {
    const syncAutomation = async () => {
      if (!email) {
        return;
      }

      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        return;
      }

      await fetch(`${runtimeConfig.apiBaseUrl}/email/automation/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          email,
          enabled: autoMailEnabled,
          fullName: profile?.fullName || '',
          targetRoles: profile?.targetRoles || [],
          primarySkills: profile?.primarySkills || [],
          preferredLocations: profile?.preferredLocations || [],
        }),
      });
    };

    void syncAutomation();
  }, [autoMailEnabled, email, getGoogleAccessToken, profile?.fullName, profile?.preferredLocations, profile?.primarySkills, profile?.targetRoles]);

  const openTailoredResume = (job: JobOpportunity) => {
    sessionStorage.setItem('career_agent_tailor_job_context', JSON.stringify(job));

    const params = new URLSearchParams({
      role: job.role,
      company: job.company,
      location: job.location,
      skills: (job.tags || []).slice(0, 8).join(', '),
      salary: job.salary || '',
      source: job.source,
      hrEmail: job.hrEmail || '',
      from: 'jobs',
    });

    navigate(`/ai-resume?${params.toString()}`);
  };

  const averageMatchRate =
    filteredJobs.length > 0
      ? Math.round(filteredJobs.reduce((total, job) => total + job.matchPercentage, 0) / filteredJobs.length)
      : 0;

  return (
    <div className="app-shell pb-24">
      <QuickProfileMenu />
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="text-sm text-primary font-semibold tracking-wide">SMART JOB DISCOVERY</span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-1">
            Job Feed
          </h1>
          <p className="text-sm text-muted-foreground">Real-time opportunities from 12+ sources (Remotive, Arbeitnow, RemoteOK, The Muse, Adzuna, and more)</p>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search jobs, companies, skills..."
              className="w-full bg-input-background border border-border/70 rounded-xl pl-11 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring/70 focus:ring-2 focus:ring-ring/20 transition-all"
            />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowFilters((value) => !value)}
            className="flex items-center gap-2 bg-card border border-border/70 rounded-lg px-4 py-2 text-sm text-muted-foreground"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>

          {/* Verified Only Toggle */}
          <button
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              verifiedOnly
                ? 'bg-primary text-primary-foreground shadow-lg shadow-black/10'
                : 'bg-card border border-border/70 text-muted-foreground'
            }`}
          >
            <Shield className="w-4 h-4" />
            100% Verified Only
          </button>
        </div>
        {showFilters ? (
          <>
            <button
              onClick={() => {
                void toggleJobAlerts();
              }}
              className={`w-full mb-3 rounded-lg px-3 py-2 text-xs font-semibold border transition-all ${
                jobAlertsEnabled
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-secondary text-secondary-foreground border-border'
              }`}
            >
              {jobAlertsEnabled
                ? `Job Alerts: ON (${notificationPermission})`
                : 'Enable New Job Notifications'}
            </button>

            <div className="grid grid-cols-2 gap-2 mb-6">
              <button
                onClick={() => setApplyableOnly((value) => !value)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold border transition-all ${
                  applyableOnly
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-secondary text-secondary-foreground border-border'
                }`}
              >
                Applyable Jobs Only
              </button>
              <button
                onClick={() => setRemoteOnly((value) => !value)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold border transition-all ${
                  remoteOnly
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-secondary text-secondary-foreground border-border'
                }`}
              >
                Remote Only
              </button>
              <select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value as 'all' | JobOpportunity['type'])}
                className="rounded-lg px-3 py-2 text-xs bg-input-background border border-border text-foreground"
              >
                <option value="all">All Types</option>
                <option value="Full-time">Full-time</option>
                <option value="Internship">Internship</option>
                <option value="Contract">Contract</option>
                <option value="Remote">Remote</option>
              </select>
              <select
                value={minMatch}
                onChange={(event) => setMinMatch(Number(event.target.value))}
                className="rounded-lg px-3 py-2 text-xs bg-input-background border border-border text-foreground"
              >
                <option value={0}>Any Match</option>
                <option value={60}>60%+ Match</option>
                <option value={70}>70%+ Match</option>
                <option value={80}>80%+ Match</option>
                <option value={90}>90%+ Match</option>
              </select>
              <button
                onClick={() => setAutoMailEnabled((value) => !value)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold border transition-all col-span-2 ${
                  autoMailEnabled
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-secondary text-secondary-foreground border-border'
                }`}
              >
                Auto Mail {autoMailEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground mb-6">Filters are collapsed. Click Show Filters to refine job results.</p>
        )}
        {/* mailStatus is shown as a fixed toast — see below */}

        {/* Stats */}
        <div className="app-surface p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground">{jobs.length}</p>
              <p className="text-sm text-muted-foreground">Global opportunities fetched</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-emerald-700">{averageMatchRate}%</p>
              <p className="text-sm text-muted-foreground">Avg. match rate</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Showing {filteredJobs.length} jobs after filters
          </p>

          <p className="text-xs text-muted-foreground mt-3">
            {isLoading
              ? 'Refreshing live jobs...'
              : isLiveData
                ? `Live feed synced${feedTime ? ` at ${new Date(feedTime).toLocaleTimeString()}` : ''}`
                : 'Fallback mode using cached opportunities'}
          </p>
          {providerSummary && typeof providerSummary.verifiedHrEmails === 'number' ? (
            <p className="text-xs text-emerald-700 mt-1">
              Verified recruiter emails identified: {String(providerSummary.verifiedHrEmails)}
            </p>
          ) : null}
          {error ? <p className="text-xs text-amber-700 mt-1">{error}</p> : null}
        </div>

        {/* Jobs List */}
        <div className="space-y-4 mb-6">
          {filteredJobs.map((job, index) => (
            <JobCardAdvanced
              key={index}
              {...job}
              isNew={job.isNew ?? false}
              hrEmailAvailable={isHrEmailActionable(job)}
              userEmail={email ?? undefined}
              userFullName={profile?.fullName}
              getGoogleAccessToken={getGoogleAccessToken}
              onTailorResume={() => openTailoredResume(job)}
              onRequestHrMail={() => requestHrMail(job)}
              onApplicationSent={() => showMailStatus(`Application sent to ${job.company}!`)}
            />
          ))}
          {!isLoading && filteredJobs.length === 0 ? (
            <div className="app-surface p-4 text-sm text-muted-foreground">
              No matching live jobs found right now. Try changing filters or search terms.
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Mail / Alert status toast — always visible above nav regardless of scroll */}
      {mailStatus ? (
        <div
          className="fixed bottom-20 left-0 right-0 mx-auto w-11/12 max-w-md z-50 bg-card/95 border border-border backdrop-blur-md text-foreground rounded-xl px-4 py-3 text-xs shadow-2xl"
          onClick={() => setMailStatus('')}
        >
          {mailStatus}
        </div>
      ) : null}
    </div>
  );
}
