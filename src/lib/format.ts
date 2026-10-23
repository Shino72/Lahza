import { siteSettings } from '../config/site';
import type { Lang } from '../content/types';

const locales: Record<Lang, string> = { ar: 'ar-EG', en: 'en-GB' };

export function formatDateTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locales[lang], {
    timeZone: siteSettings.timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locales[lang], {
    timeZone: siteSettings.timeZone,
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}
