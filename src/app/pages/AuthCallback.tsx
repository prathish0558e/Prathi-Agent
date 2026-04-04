import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { getOAuthCallbackParams } from '../lib/oauthCallback';
import { getSupabaseClient } from '../lib/supabaseClient';
import { fetchRemoteProfile } from '../lib/profileApi';
import { loadCareerProfile } from '../lib/profileStorage';
import { runtimeConfig } from '../lib/runtimeConfig';

const AUTH_EMAIL_KEY = 'career_agent_auth_email';
const GOOGLE_PROVIDER_TOKEN_KEY = 'career_agent_google_provider_token';
const GOOGLE_MAIL_ACCESS_TOKEN_KEY = 'career_agent_google_mail_access_token';
const GOOGLE_MAIL_ACCESS_TOKEN_EXPIRES_AT_KEY = 'career_agent_google_mail_access_token_expires_at';
const WELCOME_BACK_FLAG_KEY = 'career_agent_welcome_back';
const MAIL_AUTO_CONNECT_KEY = 'career_agent_mail_auto_connect_once';

export function AuthCallback() {
  const navigate = useNavigate();
  const { login, updateProfile } = useAuth();
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Verifying your Google account…');
  const navigatedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const mapOAuthError = (message: string) => {
      const normalized = message.toLowerCase();

      if (normalized.includes('unable to exchange') || normalized.includes('exchange') || normalized.includes('invalid_code')) {
        return 'Supabase cannot exchange Google authorization code. This usually means: (1) Redirect URI mismatch - Google Console must contain only https://fsciwivkplhcjsrqjnmk.supabase.co/auth/v1/callback, while Supabase keeps app URLs like http://localhost:5173/#/auth/callback. (2) Google Client ID/Secret invalid - check Supabase provider settings. (3) Code expired - took too long to callback. Try login again.';
      }

      if (normalized.includes('signup') || normalized.includes('sign up') || normalized.includes('user is not allowed')) {
        return 'Signup is currently blocked in provider settings. Enable signup in Supabase Auth and Google provider settings.';
      }

      if (normalized.includes('redirect_uri_mismatch') || normalized.includes('redirect')) {
        return 'OAuth redirect URL mismatch. Google Console Authorized redirect URI must be https://fsciwivkplhcjsrqjnmk.supabase.co/auth/v1/callback. In Supabase provider, keep app return URLs under Additional Redirect URLs such as http://localhost:5173/#/auth/callback.';
      }

      if (normalized.includes('provider is not enabled') || normalized.includes('unsupported provider')) {
        return 'Google provider is disabled in Supabase. Enable it: Dashboard > Authentication > Providers > Google > Enable. Add Client ID and Client Secret from Google Console.';
      }

      return `OAuth Error: ${message}. Check Supabase configuration and Google Console settings.`;
    };

    const resolveOnboardingCompleted = async (
      userEmail: string,
      options?: { userId?: string; fullName?: string },
    ): Promise<boolean> => {
      const localProfile = loadCareerProfile(userEmail);
      if (localProfile.onboardingCompleted) {
        return true;
      }

      const remoteProfile = await fetchRemoteProfile(userEmail);
      if (remoteProfile) {
        const mergedProfile = {
          ...localProfile,
          ...remoteProfile,
          email: userEmail,
          fullName: remoteProfile.fullName || localProfile.fullName || options?.fullName || '',
        };
        updateProfile(mergedProfile);
        if (mergedProfile.onboardingCompleted) {
          return true;
        }
      }

      if (!options?.userId) {
        return false;
      }

      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        return false;
      }

      const { data, error } = await supabaseClient
        .from('career_profiles')
        .select('onboarding_completed')
        .eq('id', options.userId)
        .maybeSingle();

      if (error || !data?.onboarding_completed) {
        return false;
      }

      updateProfile({
        ...localProfile,
        email: userEmail,
        fullName: localProfile.fullName || options.fullName || '',
        onboardingCompleted: true,
      });
      return true;
    };

    const oauthCallback = getOAuthCallbackParams();

    // ✅ FIX: Hash-ல ? இருந்தா அதுல இருந்து எடு, இல்லன்னா search params-ல இருந்து எடு
    const currentUrl = new URL(window.location.href);
    const hashQuery = currentUrl.hash.includes('?')
      ? currentUrl.hash.split('?', 2)[1] || ''
      : currentUrl.search.slice(1);

    const routeParams = new URLSearchParams(hashQuery);

    // Debug logs - token வருதா இல்லையா check பண்ண
    console.log('[AuthCallback] Full URL:', window.location.href);
    console.log('[AuthCallback] Hash:', currentUrl.hash);
    console.log('[AuthCallback] hashQuery:', hashQuery);
    console.log('[AuthCallback] mail_connected:', routeParams.get('mail_connected'));
    console.log('[AuthCallback] mail_access_token:', routeParams.get('mail_access_token') ? '✅ Found' : '❌ Not found');

    const mailConnected = routeParams.get('mail_connected');
    const mailAccessToken = routeParams.get('mail_access_token');
    const mailExpiresIn = Number(routeParams.get('mail_expires_in') || '0');
    const mailError = routeParams.get('mail_error');
    const appLogin = routeParams.get('app_login') === 'true';
    const appEmail = routeParams.get('app_email');
    const appName = routeParams.get('app_name');

    if (mailError) {
      sessionStorage.removeItem(MAIL_AUTO_CONNECT_KEY);
      setError(`Google Mail connection failed: ${decodeURIComponent(mailError)}`);
      return;
    }

    if (mailConnected === 'true' && mailAccessToken) {
      const ttlSeconds = Number.isFinite(mailExpiresIn) && mailExpiresIn > 0 ? mailExpiresIn : 3600;
      localStorage.setItem(GOOGLE_MAIL_ACCESS_TOKEN_KEY, mailAccessToken);
      localStorage.setItem(GOOGLE_PROVIDER_TOKEN_KEY, mailAccessToken);
      localStorage.setItem(
        GOOGLE_MAIL_ACCESS_TOKEN_EXPIRES_AT_KEY,
        String(Date.now() + Math.max(0, ttlSeconds - 60) * 1000),
      );
      sessionStorage.removeItem(MAIL_AUTO_CONNECT_KEY);
      if (appLogin) {
        const finishDirectLogin = async () => {
          const normalizedEmail = appEmail?.trim().toLowerCase();
          if (!normalizedEmail) {
            setError('Google sign-in completed but no email was returned. Please try again.');
            return;
          }

          login(normalizedEmail, 'direct');

          const localProfile = loadCareerProfile(normalizedEmail);
          if (appName && !localProfile.fullName) {
            updateProfile({ ...localProfile, fullName: appName });
          }

          const onboardingCompleted = await resolveOnboardingCompleted(normalizedEmail, {
            fullName: appName || undefined,
          });

          if (onboardingCompleted) {
            sessionStorage.setItem(WELCOME_BACK_FLAG_KEY, 'true');
            navigate('/', { replace: true });
            return;
          }

          navigate('/onboarding', { replace: true });
        };

        void finishDirectLogin();
        return;
      }

      console.log('[AuthCallback] ✅ Mail token saved! Redirecting to /email-logs');
      navigate('/email-logs', { replace: true });
      return;
    }

    const incomingError = oauthCallback.errorDescription || oauthCallback.error || '';
    if (incomingError) {
      setError(mapOAuthError(incomingError));
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Settings.');
      return;
    }

    const startDirectMailReconnect = async () => {
      const isNative =
        typeof window !== 'undefined' &&
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() ===
          true;

      const returnTo = isNative ? 'com.careersentinel.ai://auth/callback' : window.location.origin;
      const url = `${runtimeConfig.apiBaseUrl}/auth/google/start?returnTo=${encodeURIComponent(returnTo)}&mode=mail`;

      if (isNative) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url });
        return;
      }

      window.location.href = url;
    };

    const hasValidMailToken = () => {
      const mailToken = localStorage.getItem(GOOGLE_MAIL_ACCESS_TOKEN_KEY);
      if (!mailToken) {
        return false;
      }

      const expiresAt = Number(localStorage.getItem(GOOGLE_MAIL_ACCESS_TOKEN_EXPIRES_AT_KEY) || '0');
      if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
        return true;
      }

      return expiresAt > Date.now() + 10_000;
    };

    const triggerMailReconnect = () => {
      sessionStorage.setItem(MAIL_AUTO_CONNECT_KEY, 'true');
      void startDirectMailReconnect();
      return true;
    };

    const maybeTriggerMailConsent = async (accessToken: string | null | undefined) => {
      if (hasValidMailToken()) {
        return false;
      }

      if (sessionStorage.getItem(MAIL_AUTO_CONNECT_KEY) === 'true') {
        return false;
      }

      if (!accessToken) {
        return triggerMailReconnect();
      }

      try {
        const response = await fetch(`${runtimeConfig.apiBaseUrl}/email/diagnose-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        });

        if (!response.ok) {
          return triggerMailReconnect();
        }

        const payload = await response.json().catch(() => ({}));
        const missingScopes = payload?.diagnosis?.missingScopes || [];
        if (Array.isArray(missingScopes) && missingScopes.length > 0) {
          return triggerMailReconnect();
        }
      } catch {
        return triggerMailReconnect();
      }

      return false;
    };

    const handleSession = async (
      session: {
        user?: { email?: string; id?: string; user_metadata?: { full_name?: string } };
        provider_token?: string | null;
      },
    ) => {
      if (cancelled || navigatedRef.current) return;
      navigatedRef.current = true;

      const userEmail = session.user?.email;
      if (!userEmail) {
        setError('Google sign-in completed but no email was returned. Please try again.');
        return;
      }

      localStorage.setItem(AUTH_EMAIL_KEY, userEmail);
      if (session.provider_token) {
        localStorage.setItem(GOOGLE_PROVIDER_TOKEN_KEY, session.provider_token);
      }

      const shouldRedirectToMail = await maybeTriggerMailConsent(session.provider_token);
      if (shouldRedirectToMail) {
        return;
      }

      const onboardingCompleted = await resolveOnboardingCompleted(userEmail, {
        userId: session.user?.id,
        fullName: session.user?.user_metadata?.full_name,
      });

      if (onboardingCompleted) {
        sessionStorage.setItem(WELCOME_BACK_FLAG_KEY, 'true');
        navigate('/', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    };

    // Subscribe to auth state changes — catches implicit flow (hash tokens) and PKCE
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        void handleSession(session);
      }
    });

    // Handle PKCE code exchange + immediate session check in parallel
    const init = async () => {
      const { code, accessToken, refreshToken } = getOAuthCallbackParams();
      if (code) {
        setStatusText('Exchanging authorization code…');
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && !cancelled) {
          setError(`Authentication failed: ${mapOAuthError(exchangeError.message)}. Please try logging in again.`);
          return;
        }
      }

      if (accessToken && refreshToken) {
        setStatusText('Restoring Google session…');
        const { error: tokenSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (tokenSessionError && !cancelled) {
          setError(`Authentication failed: ${mapOAuthError(tokenSessionError.message)}. Please try logging in again.`);
          return;
        }
      }

      // Immediate check in case session was already ready
      const { data } = await supabase.auth.getSession();
      if (data.session && !cancelled) {
        void handleSession(data.session);
        return;
      }

      if (!cancelled) {
        setError('No active session returned from Google sign-in. This usually means the callback code was not exchanged correctly or the redirect URL does not exactly match Supabase settings.');
      }
    };

    void init();

    const timeout = window.setTimeout(() => {
      if (!cancelled && !navigatedRef.current) {
        setError('Sign-in timed out. Please go back and try logging in again.');
      }
    }, 14000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [login, navigate, updateProfile]);

  return (
    <div className="app-shell flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {!error ? (
          <div className="app-surface p-6 text-center">
            <div className="flex justify-center mb-4">
              <span className="w-3 h-3 bg-primary rounded-full animate-ping" />
            </div>
            <h1 className="text-xl font-semibold mb-2 text-foreground">Completing Google sign-in</h1>
            <p className="text-sm text-muted-foreground">{statusText}</p>
          </div>
        ) : (
          <div className="bg-red-100 border border-red-200 rounded-xl p-6">
            <h1 className="text-lg font-bold mb-3 text-red-700">❌ Sign-in Failed</h1>

            <div className="bg-secondary border border-border rounded-lg p-4 mb-4 text-sm">
              <p className="text-red-700 font-semibold mb-2">Error:</p>
              <p className="text-muted-foreground text-xs leading-relaxed">{error}</p>
            </div>

            <div className="bg-secondary border border-border rounded-lg p-4 mb-4">
              <p className="text-foreground font-semibold mb-2 text-xs">🔧 Fix Instructions:</p>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Go to Supabase Dashboard → Authentication → Providers → Google</li>
                <li>Check "Client ID" and "Client Secret" are filled (from Google Console)</li>
                <li>
                  Under "Additional Redirect URLs", ensure these are added:
                  <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
                    <li>http://localhost:5173/#/auth/callback</li>
                    <li>https://prathi.tech/#/auth/callback</li>
                  </ul>
                </li>
                <li>Google Cloud OAuth client type must be Web application</li>
                <li>In Google Cloud → OAuth Client → Authorized redirect URIs add: https://&lt;project-ref&gt;.supabase.co/auth/v1/callback</li>
                <li>If using Gmail direct consent, also add: http://localhost:8000/auth/google/callback</li>
                <li>Wait 1-2 minutes for changes to propagate</li>
                <li>Try login again</li>
              </ol>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full bg-primary text-primary-foreground font-semibold px-5 py-3 rounded-lg text-sm hover:opacity-95 transition-opacity"
              >
                ← Back to Login
              </button>

              <button
                onClick={() => (window.location.href = 'https://console.cloud.google.com/')}
                className="w-full bg-secondary border border-border text-secondary-foreground font-semibold px-5 py-3 rounded-lg text-sm hover:opacity-95 transition-colors"
              >
                Open Google Console
              </button>
            </div>

            <div className="mt-4 p-3 bg-secondary border border-border rounded text-xs text-muted-foreground">
              <p className="font-semibold mb-1 text-foreground">📖 Need More Help?</p>
              <p>
                Check the complete OAuth troubleshooting guide in the app's{' '}
                <code className="text-foreground bg-card px-1 py-0.5 rounded">/guidelines/OAuth_Troubleshooting.md</code> file
                for step-by-step fixes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}