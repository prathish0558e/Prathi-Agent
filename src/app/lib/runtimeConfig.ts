const SUPABASE_URL_STORAGE_KEY = 'career_agent_supabase_url';
const SUPABASE_ANON_KEY_STORAGE_KEY = 'career_agent_supabase_anon_key';

const isValidSupabaseUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

const readStoredValue = (key: string) => {
  if (typeof window === 'undefined') {
    return '';
  }

  return localStorage.getItem(key)?.trim() ?? '';
};

export const getSupabaseRuntimeConfig = () => {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

  const storedUrl = readStoredValue(SUPABASE_URL_STORAGE_KEY);
  const storedAnonKey = readStoredValue(SUPABASE_ANON_KEY_STORAGE_KEY);

  if (storedUrl && !isValidSupabaseUrl(storedUrl) && typeof window !== 'undefined') {
    localStorage.removeItem(SUPABASE_URL_STORAGE_KEY);
    localStorage.removeItem(SUPABASE_ANON_KEY_STORAGE_KEY);
  }

  const supabaseUrl = isValidSupabaseUrl(envUrl)
    ? envUrl
    : isValidSupabaseUrl(storedUrl)
      ? storedUrl
      : '';
  const supabaseAnonKey = envAnonKey || (isValidSupabaseUrl(storedUrl) ? storedAnonKey : '');

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
};

export const isSupabaseConfigured = () => {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseRuntimeConfig();
  return Boolean(isValidSupabaseUrl(supabaseUrl) && supabaseAnonKey);
};

export const saveSupabaseRuntimeConfig = (supabaseUrl: string, supabaseAnonKey: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const trimmedUrl = supabaseUrl.trim();
  if (!isValidSupabaseUrl(trimmedUrl)) {
    return;
  }

  localStorage.setItem(SUPABASE_URL_STORAGE_KEY, trimmedUrl);
  localStorage.setItem(SUPABASE_ANON_KEY_STORAGE_KEY, supabaseAnonKey.trim());
};

const resolvedApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const defaultApiBaseUrl = 'https://api.prathi.tech';

export const runtimeConfig = {
  apiBaseUrl: resolvedApiBaseUrl || defaultApiBaseUrl,
  oauthEnabled: import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === 'true',
};

export const serverSecretsNotice = {
  geminiKey: 'Store on backend only. Never expose in VITE_* variables.',
  googleClientSecret: 'Keep on backend OAuth server only.',
};