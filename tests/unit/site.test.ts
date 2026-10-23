import { describe, expect, it } from 'vitest';
import { contactLinks, defaultSettings } from '../../src/config/site';
import { demoArticles } from '../../src/content/demo/articles';
import { initialCategories } from '../../src/content/categories';
import { strings } from '../../src/i18n/strings';
import { inquirySchema } from '../../src/lib/inquiry';
import { articleDescription, jsonLdString, newsArticleJsonLd } from '../../src/lib/seo';
import { shareLinks } from '../../src/lib/share';

describe('contact details', () => {
  it('uses the exact owner-supplied values', () => {
    expect(defaultSettings.contact).toEqual({
      phone: '01101135785',
      phoneLabel: 'WhatsApp & Call',
      whatsapp: 'https://wa.me/201101135785',
      email: 'Seifkhaledamer6@gmail.com',
    });
    expect(contactLinks(defaultSettings.contact)).toEqual({
      tel: 'tel:01101135785',
      whatsapp: 'https://wa.me/201101135785',
      email: 'mailto:Seifkhaledamer6@gmail.com',
    });
  });

  it('lists the editorial leadership in both languages', () => {
    expect(defaultSettings.leadership.map((p) => [p.name.ar, p.name.en])).toEqual([
      ['سيف خالد عامر', 'Seif Khaled Amer'],
      ['ريم حرب', 'Reem Harb'],
    ]);
  });
});

describe('translations', () => {
  it('has the same keys and no empty strings in Arabic and English', () => {
    expect(Object.keys(strings.en).sort()).toEqual(Object.keys(strings.ar).sort());
    for (const lang of ['ar', 'en'] as const) {
      for (const value of Object.values(strings[lang])) expect(value.trim()).not.toBe('');
    }
  });
});

describe('inquiry validation', () => {
  const valid = {
    company: 'Example Co',
    contactPerson: 'Mona',
    email: 'mona@example.com',
    phone: '+20 110 113 5785',
    adType: 'banner',
    details: '',
    website: '',
  };

  it('accepts a complete inquiry', () => {
    expect(inquirySchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['missing company', { company: '  ' }],
    ['bad email', { email: 'not-an-email' }],
    ['bad phone', { phone: 'call me' }],
    ['unknown ad type', { adType: 'popup' }],
    ['oversized details', { details: 'x'.repeat(2001) }],
    ['filled honeypot', { website: 'http://spam.example' }],
  ])('rejects %s', (_label, change) => {
    expect(inquirySchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe('SEO helpers', () => {
  const article = demoArticles.find((a) => a.id === 'a-egypt-1')!;
  const data = newsArticleJsonLd({
    article,
    category: initialCategories[0],
    url: 'https://example.com/ar/news/x/',
    logoUrl: 'https://example.com/logo.png',
  });

  it('builds NewsArticle data from stored fields only', () => {
    expect(data).toMatchObject({
      '@type': 'NewsArticle',
      headline: article.title,
      datePublished: article.publishAt,
      inLanguage: 'ar',
      articleSection: 'مصر',
    });
    // No image is claimed when the article has none.
    expect(data).not.toHaveProperty('image');
  });

  it('never leaves the description empty', () => {
    const noSummary = { ...article, summary: '', seoDescription: undefined };
    expect(articleDescription(noSummary)).toBe((article.body[0] as { text: string }).text);
    expect(articleDescription({ ...noSummary, body: [] })).toBe(article.title);
    expect(articleDescription({ ...noSummary, summary: 'x'.repeat(300) }).length).toBeLessThanOrEqual(160);
  });

  it('escapes markup when embedding JSON-LD', () => {
    expect(jsonLdString({ x: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });

  it('encodes share URLs', () => {
    const links = shareLinks('https://example.com/a?b=1&c=2', 'عنوان & خبر');
    expect(links.facebook).toBe('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1%26c%3D2');
    expect(links.whatsapp.startsWith('https://wa.me/?text=')).toBe(true);
  });
});
