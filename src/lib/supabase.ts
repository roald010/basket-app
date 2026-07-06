import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Don't throw here: this module is imported eagerly by the root layout, so a hard
  // throw would crash every screen, including ones with no Supabase dependency (Home,
  // Lijsten, Staples, Profiel currently run on local mock data). Fall back to a
  // well-formed but non-functional placeholder -- screens that actually hit Supabase
  // (Capture, Review, List Hub) fail at the point of use instead, where they already
  // surface a normal error message rather than a boot-time crash.
  console.error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY -- copy .env.example to .env.local and fill in your project values. Supabase-backed features will fail until then.'
  );
}

export const supabase = createClient(supabaseUrl ?? 'https://placeholder.supabase.co', supabaseAnonKey ?? 'placeholder-anon-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Basket has no login screen (see design doc: only an avatar, no auth UI). Every
 * device gets a stable anonymous Supabase user on first launch, which RLS keys off
 * via auth.uid() everywhere. Upgradeable later via supabase.auth.linkIdentity().
 */
export async function ensureSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}
