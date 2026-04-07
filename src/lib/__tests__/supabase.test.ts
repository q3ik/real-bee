import { describe, it, expect } from 'vitest';

describe('supabase client', () => {
  it('exports a nullable supabase client', async () => {
    const { supabase } = await import('../supabase');
    // vitest.config.ts injects fallback VITE_SUPABASE_* values so client initializes in test env
    expect(supabase).not.toBeNull();
    expect(supabase).not.toBeUndefined();
  });
});
