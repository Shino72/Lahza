import { supabaseOrigin, turnstileEnabled } from './env';

const TURNSTILE = 'https://challenges.cloudflare.com';

export function contentSecurityPolicy(): string {
  const storage = supabaseOrigin();
  const turnstile = turnstileEnabled();
  return [
    "default-src 'self'",
    `script-src 'self'${turnstile ? ` ${TURNSTILE}` : ''}`,
    "style-src 'self'",
    `img-src 'self' data:${storage ? ` ${storage}` : ''}`,
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${turnstile ? TURNSTILE : "'none'"}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

export function applySecurityHeaders(headers: Headers, https: boolean) {
  headers.set('Content-Security-Policy', contentSecurityPolicy());
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (https) headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
}
