import { createHmac } from 'node:crypto';
import { serverEnv } from './env';
import { getServiceClient } from './supabase';

/** Pseudonymous key for a client address; raw IPs are never stored. */
export function clientKey(address: string | undefined): string {
  return createHmac('sha256', serverEnv.supabaseSecretKey ?? 'lahza').update(address ?? 'unknown').digest('hex').slice(0, 32);
}

/**
 * Fixed-window limit backed by the database so it holds across serverless instances.
 * Fails closed: if the check cannot run, the request is refused.
 */
export async function allow(scope: string, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc('rate_limit_hit', {
    p_key: `${scope}:${key}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('rate limit check failed', error.message);
    return false;
  }
  return data === true;
}
