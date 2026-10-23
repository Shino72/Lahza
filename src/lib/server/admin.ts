import type { PostgrestError } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { displayTimeZone } from '../../config/site';
import type { Lang } from '../../content/types';

export const ADMIN_LANG_COOKIE = 'lahza_admin_lang';

export function adminLang(cookies: AstroCookies): Lang {
  return cookies.get(ADMIN_LANG_COOKIE)?.value === 'en' ? 'en' : 'ar';
}

/** Maps database errors to user-facing flash keys without exposing details. */
export function errorKey(error: Pick<PostgrestError, 'code'> | null | undefined): string {
  switch (error?.code) {
    case '42501':
      return 'forbidden';
    case '23505':
      return 'duplicate';
    case '23503':
      return 'in_use';
    case '22023':
    case '23514':
    case '22P02':
    case '23502':
      return 'invalid';
    case 'PGRST116':
      return 'notFound';
    default:
      return 'failed';
  }
}

export const withFlash = (path: string, kind: 'ok' | 'error', key: string) =>
  `${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(key)}`;

export const field = (form: FormData, name: string, max = 10_000) => String(form.get(name) ?? '').trim().slice(0, max);

/** Converts a `datetime-local` value entered in Cairo time to an ISO UTC timestamp. */
export function cairoLocalToUtc(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as number[];
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  // Offset of Cairo at that instant (handles daylight saving time).
  const offsetAt = (ms: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: displayTimeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(ms));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - ms;
  };
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first)).toISOString();
}

/** ISO UTC timestamp to a `datetime-local` value in Cairo time. */
export function utcToCairoLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: displayTimeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Only allow redirects back into the dashboard. */
export function safeNext(value: string | null): string {
  return value && /^\/admin\/[a-z0-9/_-]*$/i.test(value) ? value : '/admin/';
}

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/;
