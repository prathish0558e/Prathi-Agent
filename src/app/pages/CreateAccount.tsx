import { Chrome, ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { SupabaseConfigCard } from '../components/SupabaseConfigCard';
import { isSupabaseConfigured } from '../lib/runtimeConfig';

export function CreateAccount() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(!isSupabaseConfigured());

  return (
    <div className="app-shell flex items-center justify-center px-4">
      <div className="w-full max-w-md app-surface p-6">
        <div className="mb-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground mx-auto flex items-center justify-center mb-4 shadow-[0_12px_24px_rgba(15,61,62,0.25)]">
            <UserPlus className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Create New Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your secure Prathi Agent account and continue with Google-based onboarding.</p>
        </div>

        <button
          type="button"
          disabled={isStarting}
          onClick={() => {
            void (async () => {
              setError('');
              setIsStarting(true);
              const { error: oauthError } = await loginWithGoogle({
                forceGmailScopes: true,
                useDirectOAuth: true,
                mode: 'login',
              });
              if (oauthError) {
                setError(oauthError);
                if (oauthError.includes('Missing Supabase config') || oauthError.includes('provider')) {
                  setShowSupabaseConfig(true);
                }
                setIsStarting(false);
                return;
              }

              setIsStarting(false);
            })();
          }}
          className="w-full bg-primary text-primary-foreground font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 mb-4 disabled:opacity-60 shadow-[0_14px_28px_rgba(15,61,62,0.2)]"
        >
          <Chrome className="w-4 h-4" />
          {isStarting ? 'Redirecting to Google...' : 'Continue with Google'}
        </button>

          {error ? <p className="text-xs text-red-700 text-center mb-3">{error}</p> : null}
        {showSupabaseConfig ? <SupabaseConfigCard onSaved={() => setShowSupabaseConfig(false)} /> : null}

        <div className="mt-5 rounded-lg bg-secondary/70 border border-border/70 p-3 text-xs text-secondary-foreground flex gap-2">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>Google login checks your existing profile first. New users are sent to onboarding automatically.</span>
        </div>

        <p className="text-sm text-muted-foreground mt-4 text-center">
          Already have an account? <Link to="/login" className="text-primary font-semibold">Continue with Google</Link>
        </p>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          By continuing, you agree to the <Link to="/terms-and-conditions" className="text-primary">Terms</Link> and <Link to="/privacy-policy" className="text-primary">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
