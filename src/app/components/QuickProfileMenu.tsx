import { LogOut, Mail, PencilLine, Settings, Settings2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { runtimeConfig } from '../lib/runtimeConfig';
import { useAuth } from '../auth/AuthContext';

const EMAIL_SEEN_IDS_KEY = 'career_agent_email_seen_ids';
const EMAIL_UNREAD_COUNT_KEY = 'career_agent_email_unread_count';

export function QuickProfileMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email, profile, logout, getGoogleAccessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const initials = useMemo(() => {
    const source = profile?.fullName || email || 'CA';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [email, profile?.fullName]);

  const updateUnreadCount = (count: number) => {
    const safeCount = Math.max(0, Math.min(99, Number(count) || 0));
    setUnreadCount(safeCount);
    localStorage.setItem(EMAIL_UNREAD_COUNT_KEY, String(safeCount));
  };

  useEffect(() => {
    const stored = Number(localStorage.getItem(EMAIL_UNREAD_COUNT_KEY) || '0');
    setUnreadCount(Number.isFinite(stored) && stored > 0 ? Math.min(stored, 99) : 0);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== EMAIL_UNREAD_COUNT_KEY) {
        return;
      }

      const next = Number(event.newValue || '0');
      setUnreadCount(Number.isFinite(next) && next > 0 ? Math.min(next, 99) : 0);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncUnreadFromServer = async () => {
      try {
        const accessToken = await getGoogleAccessToken();
        if (!accessToken || !mounted) {
          return;
        }

        const response = await fetch(`${runtimeConfig.apiBaseUrl}/email/summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        });

        if (!response.ok || !mounted) {
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as { recentActivity?: { id: string }[] };
        const recentActivity = Array.isArray(payload.recentActivity) ? payload.recentActivity : [];
        const seenRaw = localStorage.getItem(EMAIL_SEEN_IDS_KEY);

        const seenIds = new Set<string>();
        if (seenRaw) {
          try {
            (JSON.parse(seenRaw) as string[]).forEach((id) => seenIds.add(String(id)));
          } catch {
            // Ignore parse errors from older storage formats.
          }
        }

        const freshCount = recentActivity.filter((mail) => !seenIds.has(String(mail.id))).length;
        updateUnreadCount(freshCount);
      } catch {
        // Keep last known badge count when network checks fail.
      }
    };

    void syncUnreadFromServer();
    const timer = window.setInterval(() => {
      void syncUnreadFromServer();
    }, 8 * 60 * 1000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [getGoogleAccessToken]);

  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button
          type="button"
          aria-label="Open email monitoring"
          onClick={() => {
            updateUnreadCount(0);
            navigate('/email-logs');
          }}
          className={`relative h-10 w-10 rounded-xl border backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 ${
            location.pathname === '/email-logs'
              ? 'border-primary bg-primary text-primary-foreground shadow-[0_10px_20px_rgba(31,91,255,0.35)]'
              : 'border-border/70 bg-card/85 text-primary shadow-lg shadow-black/5'
          }`}
        >
          <Mail className="mx-auto h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          aria-label="Open settings"
          onClick={() => navigate('/settings')}
          className={`h-10 w-10 rounded-xl border backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 ${
            location.pathname === '/settings'
              ? 'border-primary bg-primary text-primary-foreground shadow-[0_10px_20px_rgba(31,91,255,0.35)]'
              : 'border-border/70 bg-card/85 text-primary shadow-lg shadow-black/5'
          }`}
        >
          <Settings className="mx-auto h-4 w-4" />
        </button>

        <button
          type="button"
          aria-label="Open profile menu"
          onClick={() => setIsOpen(true)}
          className="relative h-11 w-11 rounded-2xl border border-border/70 bg-card/85 text-primary backdrop-blur-xl shadow-lg shadow-black/5 transition-all duration-300 hover:-translate-y-0.5"
        >
          <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/15 to-sky-400/25" />
          <span className="relative flex h-full w-full items-center justify-center font-semibold text-sm">{initials}</span>
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close profile menu"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />

          <aside className="absolute right-0 top-0 h-full w-[86vw] max-w-sm border-l border-border/70 bg-[radial-gradient(circle_at_top,_rgba(31,91,255,0.18),_transparent_42%),linear-gradient(180deg,rgba(248,251,255,0.98),rgba(228,238,255,0.98))] p-5 shadow-2xl shadow-black/10 animate-[slide-in-right_240ms_ease-out]">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  <Settings2 className="h-3.5 w-3.5" />
                  Profile Hub
                </div>
                <h2 className="text-xl font-semibold text-foreground">{profile?.fullName || 'Prathi Agent User'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{email || 'Signed-in account unavailable'}</p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-border/70 bg-card px-3 py-1.5 text-sm text-muted-foreground"
              >
                Close
              </button>
            </div>

            <div className="mb-5 rounded-3xl border border-border/70 bg-card p-4 shadow-lg shadow-black/5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-sky-400 text-primary-foreground">
                  <UserRound className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{profile?.targetRoles?.[0] || 'Profile pending'}</p>
                  <p className="text-xs text-muted-foreground">{profile?.preferredLocations?.[0] || 'Location not set yet'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="rounded-2xl border border-border/70 bg-secondary/70 p-3">
                  <p className="text-muted-foreground">Skills</p>
                  <p className="mt-1 font-semibold text-foreground">{profile?.primarySkills?.length || 0}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-secondary/70 p-3">
                  <p className="text-muted-foreground">Experience</p>
                  <p className="mt-1 font-semibold text-foreground">{profile?.experienceLevel || 'Unknown'}</p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-border/70 bg-secondary/70 p-3 text-xs">
                <p className="text-muted-foreground">Email monitor</p>
                <p className="mt-1 font-semibold text-foreground">
                  {unreadCount > 0 ? `${unreadCount} unread updates` : 'All caught up'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/onboarding');
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-secondary/70 px-4 py-3 text-left text-foreground transition-colors hover:bg-secondary"
              >
                <span>
                  <span className="block text-sm font-semibold">Edit profile</span>
                  <span className="block text-xs text-muted-foreground">Role, skills, location, resume settings</span>
                </span>
                <PencilLine className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  logout();
                  navigate('/login', { replace: true });
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-left text-destructive transition-colors hover:bg-destructive/20"
              >
                <span>
                  <span className="block text-sm font-semibold">Logout</span>
                  <span className="block text-xs text-destructive/70">Switch account or refresh Google consent</span>
                </span>
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
