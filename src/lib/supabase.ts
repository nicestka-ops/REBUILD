import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { AppState } from '../types/rebuild';

export const SUPABASE_CONFIG_STORAGE_KEY = 'rebuild_supabase_config';

export interface StoredSupabaseConfig {
  url: string;
  anonKey: string;
}

const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const hasEnvSupabaseConfig = Boolean(envUrl && envAnonKey);

export function getStoredSupabaseConfig(): StoredSupabaseConfig | null {
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSupabaseConfig>;
    if (parsed.url?.trim() && parsed.anonKey?.trim()) {
      return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

export function getEffectiveSupabaseConfig(): StoredSupabaseConfig | null {
  if (hasEnvSupabaseConfig) {
    return { url: envUrl, anonKey: envAnonKey };
  }
  return getStoredSupabaseConfig();
}

export function saveStoredSupabaseConfig(url: string, anonKey: string): StoredSupabaseConfig {
  const normalized = { url: url.trim(), anonKey: anonKey.trim() };
  localStorage.setItem(SUPABASE_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearStoredSupabaseConfig(): void {
  localStorage.removeItem(SUPABASE_CONFIG_STORAGE_KEY);
}

export function createSupabaseClientFromConfig(
  config: StoredSupabaseConfig | null
): SupabaseClient | null {
  if (!config) return null;
  return createClient(config.url, config.anonKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

const rawAllowedEmails = import.meta.env.VITE_ALLOWED_EMAILS?.trim() || '';
export const allowedEmails: string[] = rawAllowedEmails
  ? rawAllowedEmails
      .split(',')
      .map((email: string) => email.trim().toLowerCase())
      .filter(Boolean)
  : [];

export function isEmailAllowed(email?: string | null): boolean {
  if (allowedEmails.length === 0) return true;
  if (!email) return false;
  return allowedEmails.includes(email.trim().toLowerCase());
}

export function extractCloudStateFromUser(user: User | null): AppState | null {
  if (!user) return null;
  const meta = user.user_metadata as { rebuild_state?: AppState } | undefined;
  const candidate = meta?.rebuild_state;
  if (candidate && typeof candidate === 'object' && candidate.records && candidate.profile) {
    return candidate;
  }
  return null;
}

export async function pushCloudState(
  client: SupabaseClient,
  state: AppState
): Promise<boolean> {
  try {
    const { error } = await client.auth.updateUser({
      data: {
        rebuild_state: state,
        rebuild_synced_at: new Date().toISOString(),
      },
    });
    return !error;
  } catch {
    return false;
  }
}
