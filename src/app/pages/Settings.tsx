import { useState, useEffect, useCallback } from 'react';
import { BottomNav } from '../components/BottomNav';
import { QuickProfileMenu } from '../components/QuickProfileMenu';
import {
  Settings as SettingsIcon,
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Loader2,
  Wifi,
  WifiOff,
  Key,
  Globe,
  Briefcase,
  AlertTriangle,
  ExternalLink,
  Zap,
  Bell,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { runtimeConfig } from '../lib/runtimeConfig';
import { applyTheme, getStoredTheme, setStoredTheme, type ThemeMode } from '../lib/theme';

interface GmailStatus {
  connected: boolean;
  hasRequiredScopes: boolean;
  missingScopes: string[];
  tokenExpiresIn: number;
  inboxCount: number | null;
  error: string | null;
}

interface BackendStatus {
  online: boolean;
  latencyMs: number | null;
  jobsEndpoint: boolean;
  emailEndpoint: boolean;
  error: string | null;
}

interface JobSourceStatus {
  name: string;
  configured: boolean;
  lastFetch: string | null;
  jobCount: number;
}

const EMAIL_ALERTS_ENABLED_KEY = 'career_agent_email_alerts_enabled';
const ADMISSION_ALERTS_ENABLED_KEY = 'career_agent_admission_alerts_enabled';

export function Settings() {
  const { email, getGoogleAccessToken, loginWithGoogle, logout } = useAuth();
  const [isCheckingGmail, setIsCheckingGmail] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [jobSources, setJobSources] = useState<JobSourceStatus[]>([]);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    return localStorage.getItem('career_agent_email_auto_sync') === 'true';
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [notificationStatus, setNotificationStatus] = useState('');
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(() => {
    return localStorage.getItem(EMAIL_ALERTS_ENABLED_KEY) === 'true';
  });
  const [admissionAlertsEnabled, setAdmissionAlertsEnabled] = useState(() => {
    return localStorage.getItem(ADMISSION_ALERTS_ENABLED_KEY) === 'true';
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());

  const updateThemeMode = (next: ThemeMode) => {
    setThemeMode(next);
    setStoredTheme(next);
    applyTheme(next);
  };

  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

  const requestBrowserPermission = async () => {
    if (!notificationsSupported) {
      setNotificationStatus('Browser notifications are not supported on this device.');
      return 'denied' as NotificationPermission;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission !== 'granted') {
      setNotificationStatus('Enable browser notifications to receive alerts.');
    } else {
      setNotificationStatus('Browser notifications enabled.');
    }

    return permission;
  };

  const toggleEmailAlerts = async () => {
    const nextValue = !emailAlertsEnabled;
    if (nextValue && notificationPermission !== 'granted') {
      const permission = await requestBrowserPermission();
      if (permission !== 'granted') {
        return;
      }
    }

    setEmailAlertsEnabled(nextValue);
    localStorage.setItem(EMAIL_ALERTS_ENABLED_KEY, String(nextValue));
  };

  const toggleAdmissionAlerts = async () => {
    const nextValue = !admissionAlertsEnabled;
    if (nextValue && notificationPermission !== 'granted') {
      const permission = await requestBrowserPermission();
      if (permission !== 'granted') {
        return;
      }
    }

    setAdmissionAlertsEnabled(nextValue);
    localStorage.setItem(ADMISSION_ALERTS_ENABLED_KEY, String(nextValue));
  };

  const notificationLabel = notificationPermission === 'granted'
    ? 'Granted'
    : notificationPermission === 'denied'
      ? 'Blocked'
      : 'Not granted';
  const notificationTone = notificationPermission === 'granted'
    ? 'text-emerald-700'
    : notificationPermission === 'denied'
      ? 'text-red-700'
      : 'text-amber-700';

  const checkBackendStatus = useCallback(async () => {
    setIsCheckingBackend(true);
    const startTime = Date.now();

    try {
      const [healthRes, jobsRes] = await Promise.all([
        fetch(`${runtimeConfig.apiBaseUrl}/health`).catch(() => null),
        fetch(`${runtimeConfig.apiBaseUrl}/jobs/feed?limit=5`).catch(() => null),
      ]);

      const latencyMs = Date.now() - startTime;
      const healthOk = healthRes?.ok ?? false;
      const jobsOk = jobsRes?.ok ?? false;

      let sources: JobSourceStatus[] = [];
      if (jobsOk) {
        const jobsData = await jobsRes?.json().catch(() => ({ providerSummary: {} }));
        const summary = jobsData?.providerSummary ?? {};

        sources = [
          { name: 'Remotive', configured: true, lastFetch: new Date().toISOString(), jobCount: summary.remotive ?? 0 },
          { name: 'Arbeitnow', configured: true, lastFetch: new Date().toISOString(), jobCount: summary.arbeitnow ?? 0 },
          { name: 'TheMuse', configured: true, lastFetch: new Date().toISOString(), jobCount: summary.themuse ?? 0 },
          { name: 'RemoteOK', configured: true, lastFetch: new Date().toISOString(), jobCount: summary.remoteok ?? 0 },
          { name: 'Adzuna', configured: Boolean(summary.adzuna), lastFetch: summary.adzuna ? new Date().toISOString() : null, jobCount: summary.adzuna ?? 0 },
        ];
      }

      setJobSources(sources);
      setBackendStatus({
        online: healthOk,
        latencyMs: healthOk ? latencyMs : null,
        jobsEndpoint: jobsOk,
        emailEndpoint: healthOk,
        error: healthOk ? null : 'Backend server is offline. Start the server with: cd server && npm run dev',
      });
    } catch (err) {
      setBackendStatus({
        online: false,
        latencyMs: null,
        jobsEndpoint: false,
        emailEndpoint: false,
        error: 'Cannot connect to backend. Make sure server is running on port 8000.',
      });
    } finally {
      setIsCheckingBackend(false);
    }
  }, []);

  const checkGmailStatus = useCallback(async () => {
    setIsCheckingGmail(true);

    try {
      const accessToken = await getGoogleAccessToken();

      if (!accessToken) {
        setGmailStatus({
          connected: false,
          hasRequiredScopes: false,
          missingScopes: ['gmail.readonly', 'gmail.send'],
          tokenExpiresIn: 0,
          inboxCount: null,
          error: 'No Google access token found. Reconnect Gmail or use direct consent below.',
        });
        return;
      }

      // Check token scopes
      const diagnoseRes = await fetch(`${runtimeConfig.apiBaseUrl}/email/diagnose-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      if (!diagnoseRes.ok) {
        const errData = await diagnoseRes.json().catch(() => ({}));
        setGmailStatus({
          connected: false,
          hasRequiredScopes: false,
          missingScopes: ['gmail.readonly', 'gmail.send'],
          tokenExpiresIn: 0,
          inboxCount: null,
          error: errData.message || 'Failed to diagnose Gmail token.',
        });
        return;
      }

      const diagnoseData = await diagnoseRes.json();
      const missingScopes = diagnoseData.diagnosis?.missingScopes ?? [];
      const expiresIn = diagnoseData.diagnosis?.expiresIn ?? 0;

      if (missingScopes.length > 0) {
        setGmailStatus({
          connected: true,
          hasRequiredScopes: false,
          missingScopes,
          tokenExpiresIn: expiresIn,
          inboxCount: null,
          error: `Missing Gmail permissions: ${missingScopes.map((s: string) => s.split('/').pop()).join(', ')}`,
        });
        return;
      }

      // Try to get email summary
      const summaryRes = await fetch(`${runtimeConfig.apiBaseUrl}/email/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setGmailStatus({
          connected: true,
          hasRequiredScopes: true,
          missingScopes: [],
          tokenExpiresIn: expiresIn,
          inboxCount: summaryData.inboxJobMailCount ?? 0,
          error: null,
        });
      } else {
        const errData = await summaryRes.json().catch(() => ({}));
        setGmailStatus({
          connected: true,
          hasRequiredScopes: false,
          missingScopes,
          tokenExpiresIn: expiresIn,
          inboxCount: null,
          error: errData.message || 'Gmail API request failed.',
        });
      }
    } catch (err) {
      setGmailStatus({
        connected: false,
        hasRequiredScopes: false,
        missingScopes: [],
        tokenExpiresIn: 0,
        inboxCount: null,
        error: err instanceof Error ? err.message : 'Failed to check Gmail status.',
      });
    } finally {
      setIsCheckingGmail(false);
    }
  }, [getGoogleAccessToken]);

  const reconnectGmail = async () => {
    setIsReconnecting(true);
    try {
      const result = await loginWithGoogle({
        forceGmailScopes: true,
        useDirectOAuth: true,
        mode: 'mail',
      });
      if (result.error) {
        setGmailStatus((prev) => (prev ? { ...prev, error: result.error } : null));
      }
    } finally {
      setIsReconnecting(false);
    }
  };

  const toggleAutoSync = () => {
    const newValue = !autoSyncEnabled;
    setAutoSyncEnabled(newValue);
    localStorage.setItem('career_agent_email_auto_sync', String(newValue));
  };

  useEffect(() => {
    void checkBackendStatus();
    void checkGmailStatus();
  }, [checkBackendStatus, checkGmailStatus]);

  useEffect(() => {
    if (!notificationsSupported) {
      return;
    }

    setNotificationPermission(Notification.permission);
  }, [notificationsSupported]);

  // Auto-sync effect
  useEffect(() => {
    if (!autoSyncEnabled) return;

    const syncInterval = setInterval(() => {
      void checkGmailStatus();
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(syncInterval);
  }, [autoSyncEnabled, checkGmailStatus]);

  return (
    <div className="app-shell pb-24">
      <QuickProfileMenu />

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            <span className="text-sm text-primary font-semibold tracking-wide">CONFIGURATION</span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-1">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">Manage your email sync, API connections, and preferences</p>
        </div>

        {/* Backend Status */}
        <section className="mb-6 app-surface p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {backendStatus?.online ? (
                <Wifi className="w-5 h-5 text-emerald-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-400" />
              )}
              <h2 className="text-lg font-semibold text-foreground">Backend Server</h2>
            </div>
            <button
              onClick={checkBackendStatus}
              disabled={isCheckingBackend}
              className="p-2 rounded-lg bg-secondary border border-border disabled:opacity-50"
            >
              <RefreshCcw className={`w-4 h-4 text-muted-foreground ${isCheckingBackend ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {backendStatus ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={backendStatus.online ? 'text-emerald-700' : 'text-red-700'}>
                  {backendStatus.online ? 'Online' : 'Offline'}
                </span>
              </div>
              {backendStatus.latencyMs !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="text-primary">{backendStatus.latencyMs}ms</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Jobs API</span>
                <span className={backendStatus.jobsEndpoint ? 'text-emerald-700' : 'text-red-700'}>
                  {backendStatus.jobsEndpoint ? 'Working' : 'Error'}
                </span>
              </div>
              {backendStatus.error && (
                <div className="mt-3 p-3 rounded-xl bg-red-100 border border-red-200 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  {backendStatus.error}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking backend status...
            </div>
          )}
        </section>

        {/* Appearance */}
        <section className="mb-6 app-surface p-4">
          <div className="flex items-center gap-2 mb-4">
            <Moon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => updateThemeMode('light')}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                themeMode === 'light'
                  ? 'bg-primary text-primary-foreground border-primary/40'
                  : 'bg-secondary text-secondary-foreground border-border'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Light
            </button>
            <button
              type="button"
              onClick={() => updateThemeMode('dark')}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                themeMode === 'dark'
                  ? 'bg-primary text-primary-foreground border-primary/40'
                  : 'bg-secondary text-secondary-foreground border-border'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => updateThemeMode('system')}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                themeMode === 'system'
                  ? 'bg-primary text-primary-foreground border-primary/40'
                  : 'bg-secondary text-secondary-foreground border-border'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              System
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            System option uses your phone theme automatically.
          </p>
        </section>

        {/* Gmail Status */}
        <section className="mb-6 app-surface p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className={`w-5 h-5 ${gmailStatus?.connected && gmailStatus?.hasRequiredScopes ? 'text-emerald-600' : 'text-amber-600'}`} />
              <h2 className="text-lg font-semibold text-foreground">Gmail Sync</h2>
            </div>
            <button
              onClick={checkGmailStatus}
              disabled={isCheckingGmail}
              className="p-2 rounded-lg bg-secondary border border-border disabled:opacity-50"
            >
              <RefreshCcw className={`w-4 h-4 text-muted-foreground ${isCheckingGmail ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {gmailStatus ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Connection</span>
                <span className={gmailStatus.connected ? 'text-emerald-700 flex items-center gap-1' : 'text-red-700 flex items-center gap-1'}>
                  {gmailStatus.connected ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {gmailStatus.connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gmail Permissions</span>
                <span className={gmailStatus.hasRequiredScopes ? 'text-emerald-700 flex items-center gap-1' : 'text-amber-700 flex items-center gap-1'}>
                  {gmailStatus.hasRequiredScopes ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {gmailStatus.hasRequiredScopes ? 'Granted' : 'Missing'}
                </span>
              </div>
              {gmailStatus.inboxCount !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Job Emails Found</span>
                  <span className="text-primary">{gmailStatus.inboxCount}</span>
                </div>
              )}
              {gmailStatus.tokenExpiresIn > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Token Expires</span>
                  <span className="text-foreground">{Math.round(gmailStatus.tokenExpiresIn / 60)} min</span>
                </div>
              )}

              {gmailStatus.error && (
                <div className="mt-3 p-3 rounded-xl bg-amber-100 border border-amber-200 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  {gmailStatus.error}
                </div>
              )}

              {(!gmailStatus.connected || !gmailStatus.hasRequiredScopes) && (
                <div className="mt-3 grid gap-2">
                  <button
                    onClick={reconnectGmail}
                    disabled={isReconnecting}
                    className="w-full rounded-xl border border-border bg-primary py-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isReconnecting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Reconnecting...</>
                    ) : (
                      <><Key className="w-4 h-4" /> Reconnect Gmail with Full Permissions</>
                    )}
                  </button>
                </div>
              )}

              {/* Setup Guide */}
              {!gmailStatus.hasRequiredScopes && (
                <div className="mt-4 p-4 rounded-xl bg-secondary border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary" />
                    Setup Guide
                  </h4>
                  <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Go to <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noreferrer" className="text-primary underline">Google Cloud Console</a></li>
                    <li>Enable Gmail API for your project</li>
                    <li>In Supabase Dashboard → Authentication → Providers → Google</li>
                    <li>Add scopes: <code className="bg-card px-1 rounded">gmail.readonly gmail.send</code></li>
                    <li>In Google Cloud → OAuth Client (Web), add redirect: <code className="bg-card px-1 rounded">http://localhost:8000/auth/google/callback</code></li>
                    <li>Click "Reconnect Gmail" button above</li>
                    <li>Accept all permissions on Google consent screen</li>
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking Gmail status...
            </div>
          )}
        </section>

        {/* Browser Alerts */}
        <section className="mb-6 app-surface p-4">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Browser Alerts</h2>
          </div>

          {!notificationsSupported ? (
            <div className="text-sm text-muted-foreground">
              Browser notifications are not supported on this device.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Permission</span>
                <span className={notificationTone}>{notificationLabel}</span>
              </div>

              {notificationPermission !== 'granted' ? (
                <button
                  onClick={() => {
                    void requestBrowserPermission();
                  }}
                  className="w-full rounded-xl border border-border bg-secondary py-3 text-sm font-semibold text-secondary-foreground"
                >
                  Enable Browser Notifications
                </button>
              ) : null}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Email reply alerts</p>
                  <p className="text-xs text-muted-foreground">New inbox replies trigger a pop-up</p>
                </div>
                <button
                  onClick={() => {
                    void toggleEmailAlerts();
                  }}
                  className={`w-12 h-6 rounded-full transition-all ${emailAlertsEnabled ? 'bg-emerald-500' : 'bg-muted'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${emailAlertsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Admissions alerts</p>
                  <p className="text-xs text-muted-foreground">Notify when a new admission is added</p>
                </div>
                <button
                  onClick={() => {
                    void toggleAdmissionAlerts();
                  }}
                  className={`w-12 h-6 rounded-full transition-all ${admissionAlertsEnabled ? 'bg-emerald-500' : 'bg-muted'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${admissionAlertsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {notificationStatus ? (
                <p className="text-xs text-muted-foreground">{notificationStatus}</p>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Alerts appear while the app is open. Phone push when the app is closed needs extra setup.
              </p>
            </div>
          )}
        </section>

        {/* Auto Sync Toggle */}
        <section className="mb-6 app-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className={`w-5 h-5 ${autoSyncEnabled ? 'text-emerald-600' : 'text-muted-foreground'}`} />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Auto Email Sync</h3>
                <p className="text-xs text-muted-foreground">Sync emails every 5 minutes</p>
              </div>
            </div>
            <button
              onClick={toggleAutoSync}
              className={`w-12 h-6 rounded-full transition-all ${autoSyncEnabled ? 'bg-emerald-500' : 'bg-muted'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${autoSyncEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </section>

        {/* Job Sources */}
        <section className="mb-6 app-surface p-4">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Job Sources</h2>
          </div>

          {jobSources.length > 0 ? (
            <div className="space-y-2">
              {jobSources.map((source) => (
                <div key={source.name} className="flex items-center justify-between p-2 rounded-xl bg-secondary">
                  <div className="flex items-center gap-2">
                    <Briefcase className={`w-4 h-4 ${source.configured ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                    <span className="text-sm text-foreground">{source.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {source.jobCount > 0 && (
                      <span className="text-xs text-primary">{source.jobCount} jobs</span>
                    )}
                    <span className={`text-xs ${source.configured ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                      {source.configured ? 'Active' : 'Not Configured'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Run backend check to see job sources status</p>
          )}
        </section>

        {/* Account Actions */}
        <section className="mb-6">
          <button
            onClick={logout}
            className="w-full rounded-xl border border-red-200 bg-red-100 py-3 text-sm font-semibold text-red-700 flex items-center justify-center gap-2"
          >
            Logout
          </button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Logged in as: {email || 'Unknown'}
          </p>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
