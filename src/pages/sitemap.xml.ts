import type { APIRoute } from 'astro';
import { findTranslation } from '../content/query';
import { languages, paths } from '../i18n/routes';
import { publicSiteData } from '../lib/site-data';

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('`site` must be configured to build the sitemap');
  const abs = (path: string) => escapeXml(new URL(path, site).toString());
  const data = { ar: publicSiteData('ar'), en: publicSiteData('en') };
  const entries: string[] = [];

  const pair = (arPath: string, enPath: string) => {
    const alternates =
      `<xhtml:link rel="alternate" hreflang="ar" href="${abs(arPath)}"/>` +
      `<xhtml:link rel="alternate" hreflang="en" href="${abs(enPath)}"/>` +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${abs(arPath)}"/>`;
    for (const path of [arPath, enPath]) {
      entries.push(`<url><loc>${abs(path)}</loc>${alternates}</url>`);
    }
  };

  pair(paths.home('ar'), paths.home('en'));
  for (const category of data.ar.categories) {
    pair(paths.category('ar', category), paths.category('en', category));
  }
  pair(paths.advertise('ar'), paths.advertise('en'));
  pair(paths.about('ar'), paths.about('en'));

  for (const lang of languages) {
    const other = lang === 'ar' ? data.en.published : data.ar.published;
    for (const article of data[lang].published) {
      const translation = findTranslation(article, other);
      const alternates = translation
        ? `<xhtml:link rel="alternate" hreflang="${article.lang}" href="${abs(paths.article(article))}"/>` +
          `<xhtml:link rel="alternate" hreflang="${translation.lang}" href="${abs(paths.article(translation))}"/>`
        : '';
      entries.push(
        `<url><loc>${abs(paths.article(article))}</loc><lastmod>${article.updatedAt}</lastmod>${alternates}</url>`,
      );
    }
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    entries.join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
