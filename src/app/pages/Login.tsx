import { Chrome, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { SupabaseConfigCard } from '../components/SupabaseConfigCard';
import { isSupabaseConfigured } from '../lib/runtimeConfig';

export function Login() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(!isSupabaseConfigured());

  const handleGoogleLogin = async () => {
    setError('');
    setIsStarting(true);
    const { error: oauthError } = await loginWithGoogle();

    if (oauthError) {
      setError(oauthError);
      if (oauthError.includes('Missing Supabase config') || oauthError.includes('provider') || oauthError.toLowerCase().includes('localhost')) {
        setShowSupabaseConfig(true);
      }
      setIsStarting(false);
    }
  };

  return (
    <div className="app-shell flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="app-surface p-6">
        <div className="mb-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground mx-auto flex items-center justify-center mb-4 shadow-[0_12px_24px_rgba(15,61,62,0.25)]">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Prathi Agent Login</h1>
          <p className="text-sm text-muted-foreground mt-1">Secure sign in required to access Gmail sync, resume vault, and job workflows.</p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            disabled={isStarting}
            onClick={() => {
              void handleGoogleLogin();
            }}
            className="w-full bg-primary text-primary-foreground font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-primary/90 transition-all shadow-[0_14px_28px_rgba(15,61,62,0.2)]"
          >
            <Chrome className="w-4 h-4" />
            {isStarting ? 'Redirecting to Google...' : 'Continue with Google'}
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-2">Login Error</p>
              <p className="text-xs text-red-700 mb-3 leading-relaxed">{error}</p>
              {error.includes('exchange') && (
                <details className="text-xs">
                  <summary className="font-semibold text-red-700 cursor-pointer mb-2">Troubleshooting Steps</summary>
                  <ol className="list-decimal list-inside text-red-700 space-y-1 ml-1">
                    <li>Check Supabase Google Provider is enabled and configured</li>
                    <li>Verify redirect URL matches exactly (include http:// or https://)</li>
                    <li>Ensure Google Client ID and Secret are correct</li>
                    <li>Wait 1-2 minutes if you just updated settings</li>
                    <li>Try again or contact support</li>
                  </ol>
                </details>
              )}
            </div>
          )}

          {showSupabaseConfig ? <SupabaseConfigCard onSaved={() => setShowSupabaseConfig(false)} /> : null}

          <p className="text-xs text-muted-foreground text-center">No password or signup form needed. Google account determines whether onboarding should open.</p>
        </div>

        <p className="text-sm text-muted-foreground mt-4 text-center">
          New here? <Link to="/create-account" className="text-primary font-semibold">Tap and continue with Google</Link>
        </p>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          By continuing, you agree to the <Link to="/terms-and-conditions" className="text-primary">Terms</Link> and <Link to="/privacy-policy" className="text-primary">Privacy Policy</Link>.
        </p>
        </div>
      </div>
    </div>
  );
}
