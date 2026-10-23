import { serverEnv, turnstileEnabled } from './env';

/** Verifies a Cloudflare Turnstile token when Turnstile is configured; otherwise returns true. */
export async function verifyTurnstile(token: string | null, remoteIp: string | undefined): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: serverEnv.turnstileSecretKey!, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const result = (await res.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
