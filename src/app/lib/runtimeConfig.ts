const SUPABASE_URL_STORAGE_KEY = 'career_agent_supabase_url';
const SUPABASE_ANON_KEY_STORAGE_KEY = 'career_agent_supabase_anon_key';

const readStoredValue = (key: string) => {
  if (typeof window === 'undefined') {
    return '';
  }

  return localStorage.getItem(key)?.trim() ?? '';
};

export const getSupabaseRuntimeConfig = () => {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

  const supabaseUrl = envUrl || readStoredValue(SUPABASE_URL_STORAGE_KEY);
  const supabaseAnonKey = envAnonKey || readStoredValue(SUPABASE_ANON_KEY_STORAGE_KEY);

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
};

export const isSupabaseConfigured = () => {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseRuntimeConfig();
  return Boolean(supabaseUrl && supabaseAnonKey);
};

export const saveSupabaseRuntimeConfig = (supabaseUrl: string, supabaseAnonKey: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(SUPABASE_URL_STORAGE_KEY, supabaseUrl.trim());
  localStorage.setItem(SUPABASE_ANON_KEY_STORAGE_KEY, supabaseAnonKey.trim());
};

export const runtimeConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  oauthEnabled: import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === 'true',
};

export const serverSecretsNotice = {
  geminiKey: 'Store on backend only. Never expose in VITE_* variables.',
  googleClientSecret: 'Keep on backend OAuth server only.',
};