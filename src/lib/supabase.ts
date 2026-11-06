import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Configuration ───────────────────────────────────────────────────────────
// Fill these in from: Supabase Dashboard → Project Settings → API
// Prefer setting them via EXPO_PUBLIC_ env vars (see .env.example).
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY_HERE';

// True only when real credentials have been provided.
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;

// A no-op WebSocket transport. We never use Supabase Realtime, and the default
// realtime client tries to open a WebSocket at various points — which crashes
// during web SSR on Node < 22 (no native WebSocket). This harmless stub prevents that.
class NoopWebSocket {
  constructor() { /* never actually connects */ }
  addEventListener() {}
  removeEventListener() {}
  send() {}
  close() {}
}

// Only create a real client when credentials are present. Otherwise export a
// stub that throws if used.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: {
        // Force a non-connecting transport so realtime never opens a socket.
        transport: NoopWebSocket as any,
      },
    })
  : (createStub() as unknown as SupabaseClient);

// Minimal stub so imports don't crash when Supabase isn't configured.
// The app's USE_DB flag ensures none of these are actually called in that state.
function createStub() {
  const notConfigured = () => {
    throw new Error('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  };
  return {
    from: notConfigured,
    rpc: notConfigured,
    auth: {},
  };
}
