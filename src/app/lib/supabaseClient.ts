import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseRuntimeConfig } from './runtimeConfig';

let client: SupabaseClient | null = null;
let configuredUrl = '';
let configuredAnonKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseRuntimeConfig();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const shouldRecreateClient =
    !client || configuredUrl !== supabaseUrl || configuredAnonKey !== supabaseAnonKey;

  if (shouldRecreateClient) {
    client = createClient(supabaseUrl, supabaseAnonKey);
    configuredUrl = supabaseUrl;
    configuredAnonKey = supabaseAnonKey;
  }

  return client;
}
