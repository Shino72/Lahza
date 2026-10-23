import type { LocalizedText, SiteSettings } from '../content/types';

export const siteName: LocalizedText = { ar: 'لحظة', en: 'Lahza' };

/** Editorial display time zone; timestamps are stored in UTC. */
export const displayTimeZone = 'Africa/Cairo';

/**
 * Defaults used until the settings rows exist (and by the demo source).
 * Once the database is connected these values are edited in the dashboard.
 */
export const defaultSettings: SiteSettings = {
  contact: {
    phone: '01101135785',
    phoneLabel: 'WhatsApp & Call',
    whatsapp: 'https://wa.me/201101135785',
    email: 'Seifkhaledamer6@gmail.com',
  },
  leadership: [
    {
      role: { ar: 'رئيس مجلس الإدارة', en: 'Chairman of the Board' },
      name: { ar: 'سيف خالد عامر', en: 'Seif Khaled Amer' },
    },
    {
      role: { ar: 'رئيسة التحرير', en: 'Editor-in-Chief' },
      name: { ar: 'ريم حرب', en: 'Reem Harb' },
    },
  ],
  advertiseIntro: {
    ar: 'نوفّر للشركات والمؤسسات مساحات إعلانية على موقع لحظة. تواصل مع فريق الإعلانات لمعرفة المساحات المتاحة والتفاصيل، وسنرد عليك في أقرب وقت.',
    en: 'Lahza offers advertising space to companies and organisations. Contact our advertising team for available placements and details, and we will get back to you shortly.',
  },
  tagline: {
    ar: 'أخبار مصر والعالم لحظة بلحظة',
    en: 'News from Egypt and the world, moment by moment',
  },
};

/** Builds the call, WhatsApp and email links from the stored contact details. */
export function contactLinks(contact: SiteSettings['contact']) {
  const digits = contact.phone.replace(/[^0-9+]/g, '');
  return {
    tel: `tel:${digits}`,
    whatsapp: contact.whatsapp,
    email: `mailto:${contact.email}`,
  };
}
