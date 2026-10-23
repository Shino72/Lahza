import type { LocalizedText } from '../content/types';

/**
 * Initial site settings. These become editable `site_settings` rows once the
 * CMS is connected; until then they are the single source for contact details.
 */
export const siteSettings = {
  name: { ar: 'لحظة', en: 'Lahza' } satisfies LocalizedText,
  tagline: {
    ar: 'أخبار مصر والعالم لحظة بلحظة',
    en: 'News from Egypt and the world, moment by moment',
  } satisfies LocalizedText,
  contact: {
    phone: '01101135785',
    phoneLabel: 'WhatsApp & Call',
    telHref: 'tel:01101135785',
    whatsappHref: 'https://wa.me/201101135785',
    email: 'Seifkhaledamer6@gmail.com',
    emailHref: 'mailto:Seifkhaledamer6@gmail.com',
  },
  leadership: [
    {
      role: { ar: 'رئيس مجلس الإدارة', en: 'Chairman of the Board' } satisfies LocalizedText,
      name: { ar: 'سيف خالد عامر', en: 'Seif Khaled Amer' } satisfies LocalizedText,
    },
    {
      role: { ar: 'رئيسة التحرير', en: 'Editor-in-Chief' } satisfies LocalizedText,
      name: { ar: 'ريم حرب', en: 'Reem Harb' } satisfies LocalizedText,
    },
  ],
  /** Editorial display time zone; timestamps are stored in UTC. */
  timeZone: 'Africa/Cairo',
} as const;
