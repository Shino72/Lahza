import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { serverEnv } from './env';

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

let publicClient: SupabaseClient | undefined;

/** Anonymous client for public pages: row level security limits it to published content. */
export function getPublicClient(): SupabaseClient {
  if (!serverEnv.supabaseUrl || !serverEnv.supabasePublishableKey) throw new Error('Supabase is not configured');
  publicClient ??= createClient(serverEnv.supabaseUrl, serverEnv.supabasePublishableKey, noSession);
  return publicClient;
}

/**
 * Privileged client. It bypasses row level security, so it is used only after
 * the caller's authorisation has been checked, and never reaches the browser.
 */
export function getServiceClient(): SupabaseClient {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseSecretKey) throw new Error('Supabase is not configured');
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseSecretKey, noSession);
}

/** Per-request client acting as the signed-in staff member, with the session in HTTP-only cookies. */
export function getUserClient(request: Request, cookies: AstroCookies): SupabaseClient {
  if (!serverEnv.supabaseUrl || !serverEnv.supabasePublishableKey) throw new Error('Supabase is not configured');
  const secure = new URL(request.url).protocol === 'https:';
  return createServerClient(serverEnv.supabaseUrl, serverEnv.supabasePublishableKey, {
    cookies: {
      getAll: () =>
        parseCookieHeader(request.headers.get('cookie') ?? '').map(({ name, value }) => ({ name, value: value ?? '' })),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookies.set(name, value, {
            ...options,
            path: '/',
            httpOnly: true,
            secure,
            sameSite: 'lax',
          });
        }
      },
    },
  });
}
