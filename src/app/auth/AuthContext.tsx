import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { getOAuthCallbackParams } from '../lib/oauthCallback';
import { getSupabaseClient } from '../lib/supabaseClient';
import { hasStoredCareerProfile, loadCareerProfile, saveCareerProfile } from '../lib/profileStorage';
import { fetchRemoteProfile, saveRemoteProfile } from '../lib/profileApi';
import { runtimeConfig } from '../lib/runtimeConfig';
import { emptyCareerProfile, type CareerProfile } from '../types/profile';

type AuthSource = 'supabase' | 'direct';

type LoginWithGoogleOptions = {
  forceGmailScopes?: boolean;
  useDirectOAuth?: boolean;
  mode?: 'login' | 'mail';
};

interface AuthContextValue {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  email: string | null;
  profile: CareerProfile | null;
  login: (email: string, source?: AuthSource) => void;
  loginWithGoogle: (options?: LoginWithGoogleOptions) => Promise<{ error: string | null }>;
  completeOAuthLogin: () => Promise<{ email: string | null; error: string | null; nextPath: '/' | '/onboarding' }>;
  getGoogleAccessToken: () => Promise<string | null>;
  refreshGoogleAccessToken: () => Promise<string | null>;
  logout: () => void;
  updateProfile: (profile: CareerProfile) => Promise<boolean>;
}

const AUTH_EMAIL_KEY = 'career_agent_auth_email';
const AUTH_SOURCE_KEY = 'career_agent_auth_source';
const GOOGLE_PROVIDER_TOKEN_KEY = 'career_agent_google_provider_token';
const GOOGLE_MAIL_ACCESS_TOKEN_KEY = 'career_agent_google_mail_access_token';
const GOOGLE_MAIL_ACCESS_TOKEN_EXPIRES_AT_KEY = 'career_agent_google_mail_access_token_expires_at';
const WELCOME_BACK_FLAG_KEY = 'career_agent_welcome_back';

const mapOAuthErrorMessage = (rawMessage: string) => {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes('unsupported provider') || normalized.includes('provider is not enabled')) {
    return 'Google provider is disabled in Supabase. Enable it in Supabase Dashboard -> Authentication -> Providers -> Google, then add Redirect URLs: https://prathi.tech/#/auth/callback and com.careersentinel.ai://auth/callback';
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Google OAuth credentials are invalid. Recheck Google Client ID and Client Secret in Supabase Provider settings.';
  }

  if (normalized.includes('invalid_scope') || normalized.includes('scope')) {
    return 'Google advanced Gmail scopes are not available in current provider setup. Basic login will still work, then enable Gmail integration later.';
  }

  if (normalized.includes('redirect_uri_mismatch') || normalized.includes('mismatch')) {
    return 'Redirect URI mismatch: Configure Google Console Authorized redirect URI as https://fsciwivkplhcjsrqjnmk.supabase.co/auth/v1/callback, and keep https://prathi.tech/#/auth/callback plus com.careersentinel.ai://auth/callback in Supabase Additional Redirect URLs.';
  }

  if (normalized.includes('unable to exchange') || normalized.includes('invalid_code') || normalized.includes('exchange')) {
    return 'Unable to exchange Google authorization code. Common fixes: (1) Redirect URL mismatch - verify exact URLs in Supabase + Google Console. (2) Supabase Client ID/Secret incorrect. (3) Code expired - took too long. (4) Provider disabled - enable Google in Supabase. Try logging in again.';
  }

  return rawMessage;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(() => {
    return localStorage.getItem(AUTH_EMAIL_KEY);
  });
  const [profile, setProfile] = useState<CareerProfile | null>(() => {
    const storedEmail = localStorage.getItem(AUTH_EMAIL_KEY);
    return storedEmail ? loadCareerProfile(storedEmail) : null;
  });

  const setAuthenticatedEmail = useCallback((nextEmail: string, source: AuthSource = 'supabase') => {
    localStorage.setItem(AUTH_EMAIL_KEY, nextEmail);
    localStorage.setItem(AUTH_SOURCE_KEY, source);
    setEmail(nextEmail);
    setProfile(loadCareerProfile(nextEmail));
  }, []);

  useEffect(() => {
    if (!email) {
      return;
    }

    let cancelled = false;

    const syncProfile = async () => {
      const localProfile = loadCareerProfile(email);
      const remoteProfile = await fetchRemoteProfile(email);
      if (cancelled) {
        return;
      }

      if (localProfile.onboardingCompleted && (!remoteProfile || !remoteProfile.onboardingCompleted)) {
        await saveRemoteProfile(localProfile);
      }

      if (!remoteProfile) {
        return;
      }

      if (localProfile.onboardingCompleted && !remoteProfile.onboardingCompleted) {
        return;
      }

      const merged = {
        ...localProfile,
        ...remoteProfile,
        email,
      };

      saveCareerProfile(merged);
      setProfile(merged);
    };

    void syncProfile();

    return () => {
      cancelled = true;
    };
  }, [email]);

  const detectExistingUser = useCallback(
    async (userId: string, userEmail: string, fullName: string | undefined): Promise<boolean> => {
      let localProfile = loadCareerProfile(userEmail);
      if (localProfile.onboardingCompleted) {
        return true;
      }

      if (!hasStoredCareerProfile(userEmail)) {
        const seedProfile: CareerProfile = {
          ...emptyCareerProfile,
          email: userEmail,
          fullName: fullName ?? '',
        };
        saveCareerProfile(seedProfile);
        localProfile = seedProfile;
      }

      const remoteProfile = await fetchRemoteProfile(userEmail);
      if (remoteProfile) {
        const mergedRemoteProfile: CareerProfile = {
          ...localProfile,
          ...remoteProfile,
          email: userEmail,
          fullName: remoteProfile.fullName || localProfile.fullName || fullName || '',
        };
        saveCareerProfile(mergedRemoteProfile);
        localProfile = mergedRemoteProfile;

        if (mergedRemoteProfile.onboardingCompleted) {
          return true;
        }
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        return localProfile.onboardingCompleted;
      }

      const { data, error } = await supabase
        .from('career_profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return localProfile.onboardingCompleted;
      }

      const onboardingDone = Boolean(data?.onboarding_completed);
      if (onboardingDone) {
        const mergedSupabaseProfile: CareerProfile = {
          ...localProfile,
          email: userEmail,
          fullName: localProfile.fullName || fullName || '',
          onboardingCompleted: true,
        };
        saveCareerProfile(mergedSupabaseProfile);
      }

      return onboardingDone;
    },
    [],
  );

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) {
          return;
        }

        const sessionEmail = data.session?.user?.email;
        if (sessionEmail) {
          setAuthenticatedEmail(sessionEmail, 'supabase');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionEmail = session?.user?.email;
      const storedSource = localStorage.getItem(AUTH_SOURCE_KEY);
      const usingDirectAuth = storedSource === 'direct';

      if (sessionEmail) {
        if (session?.provider_token) {
          localStorage.setItem(GOOGLE_PROVIDER_TOKEN_KEY, session.provider_token);
        }
        setAuthenticatedEmail(sessionEmail, 'supabase');
        return;
      }

      if (usingDirectAuth) {
        return;
      }

      localStorage.removeItem(AUTH_EMAIL_KEY);
      localStorage.removeItem(AUTH_SOURCE_KEY);
      setEmail(null);
      setProfile(null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [setAuthenticatedEmail]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthLoading,
      isAuthenticated: Boolean(email),
      email,
      profile,
      login: setAuthenticatedEmail,
      loginWithGoogle: async (options) => {
        const useDirectOAuth = options?.useDirectOAuth === true;
        if (useDirectOAuth) {
          const mode = options?.mode === 'mail' ? 'mail' : 'login';

          const startDirectOAuth = async () => {
            try {
              const configRes = await fetch(`${runtimeConfig.apiBaseUrl}/auth/google/config`);
              if (!configRes.ok) {
                return { error: `Backend Google OAuth is unreachable at ${runtimeConfig.apiBaseUrl}.` };
              }

              const config = await configRes.json().catch(() => ({}));
              if (!config.configured) {
                const warnings = Array.isArray(config.warnings) ? config.warnings.join(' ') : '';
                return { error: warnings || 'Backend Google OAuth is not configured.' };
              }
            } catch {
              return { error: `Backend Google OAuth is unreachable at ${runtimeConfig.apiBaseUrl}.` };
            }

            const isNative = Capacitor.isNativePlatform();
            const returnTo = isNative ? 'com.careersentinel.ai://auth/callback' : window.location.origin;
            const url = `${runtimeConfig.apiBaseUrl}/auth/google/start?returnTo=${encodeURIComponent(returnTo)}&mode=${mode}`;

            if (isNative) {
              const { Browser } = await import('@capacitor/browser');
              await Browser.open({ url });
              return { error: null };
            }

            window.location.href = url;
            return { error: null };
          };

          return await startDirectOAuth();
        }

        const supabase = getSupabaseClient();
        if (!supabase) {
          return {
            error: 'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
          };
        }

        const advancedScopes = [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
        ].join(' ');
        const basicScopes = ['openid', 'email', 'profile'].join(' ');

        const isNative = Capacitor.isNativePlatform();
        const redirectTo = isNative
          ? 'com.careersentinel.ai://auth/callback'
          : `${window.location.origin}/#/auth/callback`;

        const attemptLogin = async (scopes: string) => {
          const result = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo,
              scopes,
              skipBrowserRedirect: isNative,
              queryParams: {
                access_type: 'offline',
                prompt: 'consent',
              },
            },
          });

          if (isNative && !result.error && result.data?.url) {
            let oauthUrl = result.data.url;
            try {
              const authUrl = new URL(oauthUrl);
              authUrl.searchParams.set('redirect_to', 'com.careersentinel.ai://auth/callback');
              oauthUrl = authUrl.toString();
            } catch {
              // Keep original URL if parsing fails.
            }

            const { Browser } = await import('@capacitor/browser');
            await Browser.open({ url: oauthUrl });
          }

          return result;
        };

        const forceGmailScopes = options?.forceGmailScopes === true;
        const advancedAttempt = await attemptLogin(advancedScopes);
        if (!advancedAttempt.error) {
          return { error: null };
        }

        if (forceGmailScopes) {
          return {
            error: mapOAuthErrorMessage(
              `${advancedAttempt.error.message}. Gmail access needs advanced consent. Ensure Gmail scopes are enabled in Supabase Google provider and approve them on the Google consent screen.`,
            ),
          };
        }

        const advancedMessage = advancedAttempt.error.message.toLowerCase();
        const shouldFallbackToBasic =
          advancedMessage.includes('scope') ||
          advancedMessage.includes('invalid_scope') ||
          advancedMessage.includes('access_denied') ||
          advancedMessage.includes('provider is not enabled');

        if (!shouldFallbackToBasic) {
          return { error: mapOAuthErrorMessage(advancedAttempt.error.message) };
        }

        const basicAttempt = await attemptLogin(basicScopes);
        return { error: basicAttempt.error?.message ? mapOAuthErrorMessage(basicAttempt.error.message) : null };
      },
      completeOAuthLogin: async () => {
        const supabase = getSupabaseClient();
        if (!supabase) {
          return {
            email: null,
            error: 'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
            nextPath: '/onboarding',
          };
        }

        const { code } = getOAuthCallbackParams();
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            return { email: null, error: error.message, nextPath: '/onboarding' };
          }
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          return { email: null, error: error.message, nextPath: '/onboarding' };
        }

        const sessionEmail = session?.user?.email ?? null;
        if (!sessionEmail) {
          return {
            email: null,
            error: 'Google OAuth finished but no email was returned.',
            nextPath: '/onboarding',
          };
        }

        const isExistingUser = await detectExistingUser(
          session.user.id,
          sessionEmail,
          session.user.user_metadata?.full_name as string | undefined,
        );

        if (session.provider_token) {
          localStorage.setItem(GOOGLE_PROVIDER_TOKEN_KEY, session.provider_token);
        }

        setAuthenticatedEmail(sessionEmail, 'supabase');

        if (isExistingUser) {
          sessionStorage.setItem(WELCOME_BACK_FLAG_KEY, 'true');
          return { email: sessionEmail, error: null, nextPath: '/' };
        }

        return { email: sessionEmail, error: null, nextPath: '/onboarding' };
      },
      getGoogleAccessToken: async () => {
        const supabase = getSupabaseClient();
        const storedToken = localStorage.getItem(GOOGLE_PROVIDER_TOKEN_KEY);
        const directMailToken = localStorage.getItem(GOOGLE_MAIL_ACCESS_TOKEN_KEY);
        const directMailTokenExpiresAt = Number(localStorage.getItem(GOOGLE_MAIL_ACCESS_TOKEN_EXPIRES_AT_KEY) || '0');

        if (directMailToken && Number.isFinite(directMailTokenExpiresAt) && directMailTokenExpiresAt > Date.now() + 10_000) {
          return directMailToken;
        }

        // Fallback when expiry metadata is missing but token exists (best-effort request).
        if (directMailToken && (!Number.isFinite(directMailTokenExpiresAt) || directMailTokenExpiresAt <= 0)) {
          return directMailToken;
        }

        if (!supabase) {
          return storedToken || null;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const liveToken = session?.provider_token ?? null;
        if (liveToken) {
          localStorage.setItem(GOOGLE_PROVIDER_TOKEN_KEY, liveToken);
          return liveToken;
        }

        return storedToken || null;
      },
      refreshGoogleAccessToken: async () => {
        const directMailToken = localStorage.getItem(GOOGLE_MAIL_ACCESS_TOKEN_KEY);
        const directMailTokenExpiresAt = Number(localStorage.getItem(GOOGLE_MAIL_ACCESS_TOKEN_EXPIRES_AT_KEY) || '0');
        if (directMailToken && Number.isFinite(directMailTokenExpiresAt) && directMailTokenExpiresAt > Date.now() + 10_000) {
          return directMailToken;
        }

        const supabase = getSupabaseClient();
        if (!supabase) {
          return directMailToken || null;
        }

        try {
          // Force a session refresh to get a fresh OAuth token
          const { data: { session }, error } = await supabase.auth.refreshSession();
          
          if (error || !session?.provider_token) {
            // If refresh fails, return the stored token
            return localStorage.getItem(GOOGLE_PROVIDER_TOKEN_KEY) || null;
          }

          const freshToken = session.provider_token;
          localStorage.setItem(GOOGLE_PROVIDER_TOKEN_KEY, freshToken);
          return freshToken;
        } catch {
          return localStorage.getItem(GOOGLE_PROVIDER_TOKEN_KEY) || null;
        }
      },
      logout: () => {
        localStorage.removeItem(AUTH_EMAIL_KEY);
        localStorage.removeItem(AUTH_SOURCE_KEY);
        localStorage.removeItem(GOOGLE_PROVIDER_TOKEN_KEY);
        localStorage.removeItem(GOOGLE_MAIL_ACCESS_TOKEN_KEY);
        localStorage.removeItem(GOOGLE_MAIL_ACCESS_TOKEN_EXPIRES_AT_KEY);
        const supabase = getSupabaseClient();
        if (supabase) {
          void supabase.auth.signOut();
        }
        setEmail(null);
        setProfile(null);
      },
      updateProfile: async (nextProfile: CareerProfile) => {
        saveCareerProfile(nextProfile);
        setProfile(nextProfile);
        return await saveRemoteProfile(nextProfile);
      },
    }),
    [detectExistingUser, email, isAuthLoading, profile, setAuthenticatedEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
