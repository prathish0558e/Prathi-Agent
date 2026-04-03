import { LogOut, PencilLine, Settings2, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';

export function QuickProfileMenu() {
  const navigate = useNavigate();
  const { email, profile, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const initials = useMemo(() => {
    const source = profile?.fullName || email || 'CA';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [email, profile?.fullName]);

  return (
    <>
      <button
        type="button"
        aria-label="Open profile menu"
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-50 h-12 w-12 rounded-2xl border border-border/70 bg-card/80 text-primary backdrop-blur-xl shadow-lg shadow-black/5 transition-all duration-300 hover:-translate-y-0.5"
      >
        <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-amber-300/20" />
        <span className="relative flex h-full w-full items-center justify-center font-semibold text-sm">{initials}</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close profile menu"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />

          <aside className="absolute right-0 top-0 h-full w-[86vw] max-w-sm border-l border-border/70 bg-[radial-gradient(circle_at_top,_rgba(15,61,62,0.14),_transparent_35%),linear-gradient(180deg,rgba(255,250,242,0.98),rgba(243,227,205,0.98))] p-5 shadow-2xl shadow-black/10 animate-[slide-in-right_240ms_ease-out]">
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-300 text-primary-foreground">
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
