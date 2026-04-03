import { BottomNav } from '../components/BottomNav';
import { Mail, CheckCircle2, Clock, RefreshCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { runtimeConfig } from '../lib/runtimeConfig';

interface RecentMail {
  id: string;
  from: string;
  subject: string;
  date: string;
}

const EMAIL_RECONNECT_COOLDOWN_MS = 3 * 60 * 1000;
const EMAIL_RECONNECT_TS_KEY = 'career_agent_email_reconnect_attempt_at';
const EMAIL_SEEN_IDS_KEY = 'career_agent_email_seen_ids';
const EMAIL_ALERTS_ENABLED_KEY = 'career_agent_email_alerts_enabled';

const canNotifyEmailReplies = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  return localStorage.getItem(EMAIL_ALERTS_ENABLED_KEY) === 'true';
};

export function EmailLogs() {
  const { getGoogleAccessToken, refreshGoogleAccessToken, loginWithGoogle } = useAuth();
  const reconnectAttemptedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [tokenStatus, setTokenStatus] = useState('Checking Google Mail access...');
  const [jobMailCount, setJobMailCount] = useState(0);
  const [sentReplyCount, setSentReplyCount] = useState(0);
  const [recentMails, setRecentMails] = useState<RecentMail[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const retryCountRef = useRef(0);
  const mailAlertsReadyRef = useRef(false);

  const shouldAutoReconnect = () => {
    const lastAttemptRaw = sessionStorage.getItem(EMAIL_RECONNECT_TS_KEY);
    const lastAttempt = lastAttemptRaw ? Number(lastAttemptRaw) : 0;
    const now = Date.now();
    return Number.isFinite(lastAttempt) ? now - lastAttempt > EMAIL_RECONNECT_COOLDOWN_MS : true;
  };

  const markReconnectAttempt = () => {
    sessionStorage.setItem(EMAIL_RECONNECT_TS_KEY, String(Date.now()));
    reconnectAttemptedRef.current = true;
  };

  const reconnectGoogleMailAccess = async () => {
    const oauthResult = await loginWithGoogle({
      forceGmailScopes: true,
      useDirectOAuth: true,
      mode: 'mail',
    });
    if (oauthResult.error) {
      setError(oauthResult.error);
    }
  };

  const loadSummary = async (forceTokenRefresh = false) => {
    setError('');
    setIsLoading(true);
    setTokenStatus('Checking Google Mail access...');

    try {
      let accessToken = await getGoogleAccessToken();
      
      if (!accessToken) {
        if (!reconnectAttemptedRef.current && shouldAutoReconnect()) {
          markReconnectAttempt();
          setError('Google Mail token missing. Redirecting to Google Mail consent...');
          await reconnectGoogleMailAccess();
          return;
        }

        throw new Error('Google Mail token not found. Connect Google Mail access again.');
      }

      setTokenStatus('Google token found. Loading Gmail summary...');

      let response = await fetch(`${runtimeConfig.apiBaseUrl}/email/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken }),
      });

      // If request fails with 401/403 and we haven't already retried, try refreshing token
      if ((response.status === 401 || response.status === 403) && !forceTokenRefresh && retryCountRef.current === 0) {
        retryCountRef.current += 1;
        const refreshedToken = await refreshGoogleAccessToken();
        
        if (refreshedToken && refreshedToken !== accessToken) {
          setTokenStatus('Token refreshed. Retrying Gmail summary...');
          // Recursively call with refreshed token and forceTokenRefresh=true to prevent infinite loop
          return await loadSummary(true);
        }
      }

      if (!response.ok) {
        const details = await response.json().catch(() => ({}));

        if (response.status === 403) {
          if (!reconnectAttemptedRef.current && shouldAutoReconnect()) {
            markReconnectAttempt();
            setError('Gmail scopes missing. Redirecting to Google Mail consent...');
            await reconnectGoogleMailAccess();
            return;
          }

          const diagResponse = await fetch(`${runtimeConfig.apiBaseUrl}/email/diagnose-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken }),
          });
          const diag = await diagResponse.json().catch(() => ({}));
          const missing = (diag?.diagnosis?.missingScopes || []).join(', ');
          throw new Error(
            `${details.message || 'Insufficient Gmail scopes.'}${missing ? ` Missing: ${missing}.` : ''} Logout and login again with Google consent.`,
          );
        }

        if (response.status === 401) {
          throw new Error('Gmail access token expired or invalid. Please reconnect your Google account.');
        }

        throw new Error(details.message || 'Unable to read Gmail summary.');
      }

      const payload = (await response.json()) as {
        inboxJobMailCount: number;
        sentReplyCount: number;
        recentActivity: RecentMail[];
      };

      const seenRaw = localStorage.getItem(EMAIL_SEEN_IDS_KEY);
      const seenIds = new Set<string>();
      if (seenRaw) {
        try {
          (JSON.parse(seenRaw) as string[]).forEach((id) => seenIds.add(String(id)));
        } catch {
          // ignore parse errors
        }
      }

      const freshMails = payload.recentActivity.filter((mail) => !seenIds.has(String(mail.id)));
      if (mailAlertsReadyRef.current && freshMails.length > 0 && canNotifyEmailReplies()) {
        const headline = freshMails[0];
        const summary = headline
          ? `Latest: ${headline.subject} (${headline.from}).`
          : '';
        new Notification('New email replies', {
          body: `${freshMails.length} new reply emails. ${summary}`.trim(),
        });
      }

      setJobMailCount(payload.inboxJobMailCount);
      setSentReplyCount(payload.sentReplyCount);
      setRecentMails(payload.recentActivity);
      setTokenStatus('Google Mail connected successfully.');
      sessionStorage.removeItem(EMAIL_RECONNECT_TS_KEY);
      reconnectAttemptedRef.current = false;
      retryCountRef.current = 0;
      mailAlertsReadyRef.current = true;

      localStorage.setItem(
        EMAIL_SEEN_IDS_KEY,
        JSON.stringify(payload.recentActivity.map((mail) => String(mail.id))),
      );
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load mail logs.';
      setTokenStatus('Google Mail not connected yet.');
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadSummary();
    
    // Set up periodic refresh every 5 minutes
    const pollingInterval = setInterval(() => {
      void loadSummary();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, []);

  return (
    <div className="app-shell pb-24">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <span className="text-sm text-primary font-semibold tracking-wide">REAL GMAIL SUMMARY</span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-1">
            Email Logs
          </h1>
          <p className="text-sm text-muted-foreground">Live inbox and sent-mail counts from your connected Google account</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="app-surface p-4 text-center">
            <p className="text-2xl font-semibold text-primary mb-1">{isLoading ? '...' : jobMailCount}</p>
            <p className="text-xs text-muted-foreground">Job-related inbox mails</p>
          </div>
          <div className="app-surface p-4 text-center">
            <p className="text-2xl font-semibold text-primary mb-1">{isLoading ? '...' : sentReplyCount}</p>
            <p className="text-xs text-muted-foreground">Replies sent by you</p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsRefreshing(true);
            void loadSummary();
          }}
          disabled={isRefreshing}
          className="w-full mb-4 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_12px_24px_rgba(15,61,62,0.2)]"
        >
          <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Syncing Emails...' : 'Refresh Mail Summary'}
        </button>

        <p className="text-[11px] text-muted-foreground mb-3">{tokenStatus}</p>

        {error ? <p className="text-xs text-red-700 mb-3">{error}</p> : null}

        {error.toLowerCase().includes('google mail token') || error.toLowerCase().includes('google consent') || error.toLowerCase().includes('gmail scopes') ? (
          <button
            type="button"
            onClick={() => {
              void reconnectGoogleMailAccess();
            }}
            className="w-full mb-4 bg-secondary border border-border/70 text-secondary-foreground rounded-lg py-2 text-sm font-semibold"
          >
            Reconnect Google Mail Access With Gmail Consent
          </button>
        ) : null}

        <div className="space-y-3 mb-6">
          {recentMails.map((mail) => (
            <div key={mail.id} className="app-surface p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm text-foreground font-semibold line-clamp-2">{mail.subject}</p>
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">From: {mail.from}</p>
              <p className="text-xs text-muted-foreground">{mail.date}</p>
            </div>
          ))}
          {!isLoading && recentMails.length === 0 ? (
            <div className="app-surface p-4 text-sm text-muted-foreground">
              No recent job-related inbox messages found for the last 45 days.
            </div>
          ) : null}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
