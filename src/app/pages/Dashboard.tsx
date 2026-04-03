import { CircularProgress } from '../components/CircularProgress';
import { JobCardAdvanced } from '../components/JobCardAdvanced';
import { BottomNav } from '../components/BottomNav';
import { QuickProfileMenu } from '../components/QuickProfileMenu';
import { SkillRadar } from '../components/SkillRadar';
import { StatCard } from '../components/StatCard';
import { Mail, Send, Briefcase, Activity, MapPinned, Sparkles, Settings, AlertTriangle, CheckCircle2, RefreshCcw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useEffect, useState } from 'react';
import type { JobOpportunity } from '../types/careerAgent';
import { useNavigate } from 'react-router';
import { runtimeConfig } from '../lib/runtimeConfig';

const JOB_CACHE_KEY = 'career_agent_last_jobs_feed';

type EmailSyncStatus = 'loading' | 'connected' | 'needs_setup' | 'error';

export function Dashboard() {
  const navigate = useNavigate();
  const { email, profile, getGoogleAccessToken } = useAuth();
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [topJobs, setTopJobs] = useState<JobOpportunity[]>([]);
  const [inboxJobMailCount, setInboxJobMailCount] = useState<number | null>(null);
  const [sentReplyCount, setSentReplyCount] = useState<number | null>(null);
  const [activeJobCount, setActiveJobCount] = useState<number | null>(null);
  const [emailSyncStatus, setEmailSyncStatus] = useState<EmailSyncStatus>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const shouldShowPopup = sessionStorage.getItem('career_agent_welcome_back') === 'true';
    if (!shouldShowPopup) {
      return;
    }

    setShowWelcomeBack(true);
    sessionStorage.removeItem('career_agent_welcome_back');

    const timer = window.setTimeout(() => {
      setShowWelcomeBack(false);
    }, 2800);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const syncDashboardData = async () => {
      const cached = localStorage.getItem(JOB_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as JobOpportunity[];
          const applyable = parsed.filter((job) => Boolean(job.applyUrl));
          setActiveJobCount(applyable.length);
          if (applyable.length > 0) {
            setTopJobs(applyable.sort((a, b) => b.matchPercentage - a.matchPercentage).slice(0, 2));
          }
        } catch {
          // Ignore cache parse errors
        }
      }

      try {
        const response = await fetch(`${runtimeConfig.apiBaseUrl}/jobs/feed?${new URLSearchParams({ limit: '30' }).toString()}`, {
          method: 'GET',
        });

        if (response.ok) {
          const payload = (await response.json()) as { jobs: JobOpportunity[] };
          const liveJobs = Array.isArray(payload.jobs) ? payload.jobs.filter((job) => Boolean(job.applyUrl)) : [];
          setActiveJobCount(liveJobs.length);
          if (liveJobs.length > 0) {
            setTopJobs(liveJobs.sort((a, b) => b.matchPercentage - a.matchPercentage).slice(0, 2));
            localStorage.setItem(JOB_CACHE_KEY, JSON.stringify(liveJobs));
          }
        }
      } catch {
        // Keep cached value if live fetch fails.
      }

      // Email sync with better status tracking
      try {
        const accessToken = await getGoogleAccessToken();
        if (!accessToken) {
          setEmailSyncStatus('needs_setup');
          setInboxJobMailCount(null);
          setSentReplyCount(null);
          return;
        }

        const summaryResponse = await fetch(`${runtimeConfig.apiBaseUrl}/email/summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accessToken }),
        });

        if (!summaryResponse.ok) {
          const errorData = await summaryResponse.json().catch(() => ({}));
          const errorMsg = String(errorData.message || '').toLowerCase();

          if (summaryResponse.status === 403 || errorMsg.includes('scope') || errorMsg.includes('permission')) {
            setEmailSyncStatus('needs_setup');
          } else {
            setEmailSyncStatus('error');
          }
          setInboxJobMailCount(null);
          setSentReplyCount(null);
          return;
        }

        const payload = (await summaryResponse.json()) as {
          inboxJobMailCount: number;
          sentReplyCount: number;
        };
        setInboxJobMailCount(payload.inboxJobMailCount);
        setSentReplyCount(payload.sentReplyCount);
        setEmailSyncStatus('connected');
      } catch {
        setEmailSyncStatus('error');
        setInboxJobMailCount(null);
        setSentReplyCount(null);
      }
    };

    void syncDashboardData();
  }, [getGoogleAccessToken]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setEmailSyncStatus('loading');

    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        setEmailSyncStatus('needs_setup');
        return;
      }

      const [jobsRes, emailRes] = await Promise.all([
        fetch(`${runtimeConfig.apiBaseUrl}/jobs/feed?limit=30`),
        fetch(`${runtimeConfig.apiBaseUrl}/email/summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        }),
      ]);

      if (jobsRes.ok) {
        const jobsData = (await jobsRes.json()) as { jobs: JobOpportunity[] };
        const liveJobs = Array.isArray(jobsData.jobs) ? jobsData.jobs.filter((job) => Boolean(job.applyUrl)) : [];
        setActiveJobCount(liveJobs.length);
        if (liveJobs.length > 0) {
          setTopJobs(liveJobs.sort((a, b) => b.matchPercentage - a.matchPercentage).slice(0, 2));
          localStorage.setItem(JOB_CACHE_KEY, JSON.stringify(liveJobs));
        }
      }

      if (emailRes.ok) {
        const emailData = await emailRes.json();
        setInboxJobMailCount(emailData.inboxJobMailCount);
        setSentReplyCount(emailData.sentReplyCount);
        setEmailSyncStatus('connected');
      } else {
        setEmailSyncStatus('needs_setup');
      }
    } catch {
      setEmailSyncStatus('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const openTailoredResume = (job: JobOpportunity) => {
    const params = new URLSearchParams({
      role: job.role,
      company: job.company,
      location: job.location,
      skills: (job.tags || []).slice(0, 8).join(', '),
      salary: job.salary || '',
      source: job.source,
    });
    navigate(`/ai-resume?${params.toString()}`);
  };

  const requestHrMail = (job: JobOpportunity) => {
    const receiver = job.hrEmail || 'hr@company.com';
    const subject = encodeURIComponent(`Application for ${job.role} - ${profile?.fullName || 'Candidate'}`);
    const body = encodeURIComponent(
      `Hi ${job.company} Hiring Team,\n\nI am interested in the ${job.role} position. Please find my resume attached.\n\nRegards,\n${profile?.fullName || email || 'Candidate'}`,
    );
    window.location.href = `mailto:${receiver}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="app-shell pb-24">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md mx-auto px-4 py-6">
        <QuickProfileMenu />

        {/* Header - System Online */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-lg shadow-black/10" />
              <span className="text-sm text-primary font-semibold tracking-wide">SYSTEM ONLINE</span>
            </div>
            <h1 className="text-3xl font-semibold text-foreground">
              Hello {profile?.fullName || 'Candidate'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              CareerSentinel AI • {profile?.targetRoles[0] || email || 'Command Center'}
            </p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/jobs')}
            className="app-surface px-4 py-3 text-left hover:shadow-lg transition-shadow"
          >
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Smart Search</span>
            </div>
            <p className="text-sm font-semibold text-foreground">AI job feed</p>
            <p className="text-xs text-muted-foreground">Filters, exact posts, resume tailoring</p>
          </button>

          <button
            onClick={() => navigate('/local-tracker')}
            className="app-surface px-4 py-3 text-left hover:shadow-lg transition-shadow"
          >
            <div className="mb-2 flex items-center gap-2 text-primary">
              <MapPinned className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Nearby Hunt</span>
            </div>
            <p className="text-sm font-semibold text-foreground">Local company radar</p>
            <p className="text-xs text-muted-foreground">Google Maps based nearby company lookup</p>
          </button>
        </div>

        {/* Email Sync Status Banner */}
        <div className="mb-6">
          <div
            onClick={() => emailSyncStatus === 'needs_setup' ? navigate('/email-logs') : handleRefresh()}
            className={`rounded-2xl border p-4 flex items-center justify-between cursor-pointer transition-all ${
              emailSyncStatus === 'connected'
                ? 'border-emerald-400/30 bg-emerald-500/10'
                : emailSyncStatus === 'needs_setup'
                  ? 'border-amber-400/30 bg-amber-500/10'
                  : emailSyncStatus === 'error'
                    ? 'border-red-400/30 bg-red-500/10'
                    : 'border-border/70 bg-card/70'
            }`}
          >
            <div className="flex items-center gap-3">
              {emailSyncStatus === 'loading' ? (
                <RefreshCcw className="w-5 h-5 text-muted-foreground animate-spin" />
              ) : emailSyncStatus === 'connected' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : emailSyncStatus === 'needs_setup' ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
              <div>
                <p className={`text-sm font-semibold ${
                  emailSyncStatus === 'connected' ? 'text-emerald-600' :
                  emailSyncStatus === 'needs_setup' ? 'text-amber-600' :
                  emailSyncStatus === 'error' ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {emailSyncStatus === 'loading' ? 'Syncing emails...' :
                   emailSyncStatus === 'connected' ? 'Email sync active' :
                   emailSyncStatus === 'needs_setup' ? 'Gmail setup required' :
                   'Email sync error'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {emailSyncStatus === 'connected' ? 'Tap to refresh' :
                   emailSyncStatus === 'needs_setup' ? 'Tap to configure Gmail access' :
                   emailSyncStatus === 'error' ? 'Tap to retry' : 'Please wait...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {emailSyncStatus === 'needs_setup' && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('/settings'); }}
                  className="p-2 rounded-lg bg-secondary border border-border/70"
                >
                  <Settings className="w-4 h-4 text-amber-600" />
                </button>
              )}
              {emailSyncStatus !== 'loading' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
                  disabled={isRefreshing}
                  className="p-2 rounded-lg bg-card border border-border/70"
                >
                  <RefreshCcw className={`w-4 h-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hero Section - Global Job Match Gauge */}
        <div className="app-surface p-6 mb-6">
          <div className="flex flex-col items-center">
            <div className="mb-4">
              <CircularProgress percentage={88} size={200} strokeWidth={14} />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-1">Global Job Match</h2>
              <p className="text-sm text-muted-foreground">AI-powered career compatibility score</p>
              <div className="flex items-center justify-center gap-1 mt-3 text-primary text-sm font-semibold">
                <Activity className="w-4 h-4" />
                <span>OPTIMAL MATCH DETECTED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            title="Emails Scanned"
            value={inboxJobMailCount ?? '--'}
            icon={<Mail className="w-5 h-5 text-primary" />}
            color="blue"
          />
          <StatCard
            title="Auto-Replies"
            value={sentReplyCount ?? '--'}
            icon={<Send className="w-5 h-5 text-primary" />}
            color="green"
          />
          <StatCard
            title="New Jobs"
            value={activeJobCount ?? '--'}
            icon={<Briefcase className="w-5 h-5 text-primary" />}
            color="cyan"
          />
        </div>

        {/* Skill Radar */}
        <div className="mb-6">
          <SkillRadar />
        </div>

        {/* Top Matched Jobs Preview */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <span className="w-1 h-6 bg-primary rounded-full" />
              Top Matches Today
            </h2>
          </div>
          <div className="space-y-4">
            {topJobs.map((job, index) => (
              <JobCardAdvanced
                key={index}
                {...job}
                onTailorResume={() => openTailoredResume(job)}
                onRequestHrMail={() => requestHrMail(job)}
              />
            ))}
            {topJobs.length === 0 ? (
              <div className="app-surface p-4 text-sm text-muted-foreground">
                No exact live jobs cached yet. Open Jobs page and refresh live feed to get accurate apply links.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />

      {showWelcomeBack ? (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-secondary border border-border/70 backdrop-blur-md text-foreground rounded-full px-4 py-2 text-sm shadow-lg">
          Welcome back! Resuming your job assistant.
        </div>
      ) : null}
    </div>
  );
}
