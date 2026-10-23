import { describe, expect, it } from 'vitest';
import { parseServerEnv } from '../../src/lib/server/env-parse';

describe('deployment settings', () => {
  const warnings: string[] = [];
  const parse = (raw: Record<string, string>) => parseServerEnv(raw, (m) => warnings.push(m));

  it('ignores malformed values instead of failing', () => {
    const env = parse({ SUPABASE_URL: 'abc.supabase.co', GOOGLE_LOGIN_ENABLED: 'yes', LAHZA_CONTENT_SOURCE: 'live' });
    expect(env.supabaseUrl).toBeUndefined();
    expect(env.googleLoginEnabled).toBe(false);
    expect(env.contentSource).toBe('auto');
    expect(warnings).toHaveLength(3);
  });

  it('accepts valid values and trims whitespace or a trailing slash', () => {
    const env = parse({ SUPABASE_URL: ' https://abc.supabase.co/ ', SUPABASE_SECRET_KEY: ' key \n', GOOGLE_LOGIN_ENABLED: 'TRUE' });
    expect(env.supabaseUrl).toBe('https://abc.supabase.co');
    expect(env.supabaseSecretKey).toBe('key');
    expect(env.googleLoginEnabled).toBe(true);
  });

  it('treats empty values as unset', () => {
    const env = parse({ SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '   ' });
    expect(env.supabaseUrl).toBeUndefined();
    expect(env.supabasePublishableKey).toBeUndefined();
  });
});
