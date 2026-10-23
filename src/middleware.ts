import { defineMiddleware } from 'astro:middleware';
import { loadAccess } from './lib/server/access';
import { ADMIN_LANG_COOKIE } from './lib/server/admin';
import { backendConfigured } from './lib/server/env';
import { applySecurityHeaders } from './lib/server/headers';
import { getUserClient } from './lib/server/supabase';

// Reachable without a session.
const OPEN_ADMIN_PATHS = ['/admin/login/', '/admin/forgot-password/', '/admin/auth/confirm/', '/admin/auth/callback/', '/admin/setup/'];
// Need a session but not a completed sign-in (password set, MFA verified).
const SESSION_ADMIN_PATHS = ['/admin/set-password/', '/admin/mfa/setup/', '/admin/mfa/verify/', '/admin/logout/'];

const redirect = (to: string) => new Response(null, { status: 303, headers: { Location: to } });

export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;
  const path = url.pathname;
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const https = url.protocol === 'https:';

  let response: Response;
  try {
    response = isAdmin ? await handleAdmin(context, next, path) : await next();
  } catch (error) {
    // Supabase errors are plain objects; log their fields, never show them to the visitor.
    console.error('request failed', path, error instanceof Error ? error.stack : JSON.stringify(error));
    response = new Response('Something went wrong. Please try again.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  if (isAdmin) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  } else {
    const readOnly = context.request.method === 'GET' || context.request.method === 'HEAD';
    if (readOnly && response.status === 200 && !response.headers.has('Cache-Control')) {
      // Short CDN cache so dashboard changes reach readers within about a minute.
      response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    } else if (!readOnly) {
      response.headers.set('Cache-Control', 'no-store');
    }
  }
  applySecurityHeaders(response.headers, https);
  return response;
});

async function handleAdmin(
  context: Parameters<Parameters<typeof defineMiddleware>[0]>[0],
  next: () => Promise<Response>,
  path: string,
): Promise<Response> {
  if (!backendConfigured()) {
    return new Response('Lahza dashboard: the database is not configured for this deployment.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const ui = context.url.searchParams.get('ui');
  if (ui === 'ar' || ui === 'en') {
    context.cookies.set(ADMIN_LANG_COOKIE, ui, { path: '/admin/', httpOnly: true, sameSite: 'lax', maxAge: 31536000 });
  }

  const supabase = getUserClient(context.request, context.cookies);
  context.locals.supabase = supabase;
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;
  context.locals.user = user;

  if (OPEN_ADMIN_PATHS.some((p) => path.startsWith(p))) {
    return next();
  }
  if (!user) {
    return redirect(`/admin/login/?next=${encodeURIComponent(path)}`);
  }

  const access = await loadAccess(supabase);
  context.locals.access = access;
  if (!access || access.status === 'suspended') {
    await supabase.auth.signOut();
    return redirect('/admin/login/?error=access');
  }
  if (SESSION_ADMIN_PATHS.some((p) => path.startsWith(p))) {
    return next();
  }
  if (access.status === 'invited') {
    return redirect('/admin/set-password/?flow=invite');
  }
  if (access.mfaRequired && access.aal !== 'aal2') {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    return redirect((factors?.totp ?? []).some((f) => f.status === 'verified') ? '/admin/mfa/verify/' : '/admin/mfa/setup/');
  }
  return next();
}
