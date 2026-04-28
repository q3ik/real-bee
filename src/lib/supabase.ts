import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // In test environments Vitest sets NODE_ENV to 'test'. Allow tests and CI
  // that have not configured real Supabase credentials to proceed by throwing
  // only in production/development builds. The test setup file must inject
  // placeholder values (e.g. VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test)
  // via vitest config or a .env.test file so the client initialises without
  // real credentials but module loading does not crash.
  if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
    throw new Error(
      '[supabase] Missing required environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY'
    );
  }
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'http://localhost',
  supabaseAnonKey ?? 'test-anon-key'
);
