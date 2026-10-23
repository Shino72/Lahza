import type { APIRoute } from 'astro';
import { paths } from '../i18n/routes';
import { getRepository } from '../lib/server/content';

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('`site` must be configured to build the sitemap');
  const abs = (path: string) => escapeXml(new URL(path, site).toString());
  const repo = getRepository();
  const [categories, articles] = await Promise.all([repo.categories(), repo.allPublished()]);
  const entries: string[] = [];

  const pair = (arPath: string, enPath: string) => {
    const alternates =
      `<xhtml:link rel="alternate" hreflang="ar" href="${abs(arPath)}"/>` +
      `<xhtml:link rel="alternate" hreflang="en" href="${abs(enPath)}"/>` +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${abs(arPath)}"/>`;
    for (const path of [arPath, enPath]) entries.push(`<url><loc>${abs(path)}</loc>${alternates}</url>`);
  };

  pair(paths.home('ar'), paths.home('en'));
  for (const category of categories) pair(paths.category('ar', category), paths.category('en', category));
  pair(paths.advertise('ar'), paths.advertise('en'));
  pair(paths.about('ar'), paths.about('en'));

  const byGroup = new Map<string, typeof articles>();
  for (const a of articles) {
    if (a.translationKey) byGroup.set(a.translationKey, [...(byGroup.get(a.translationKey) ?? []), a]);
  }
  for (const article of articles) {
    const translation = article.translationKey
      ? byGroup.get(article.translationKey)?.find((a) => a.lang !== article.lang)
      : undefined;
    const alternates = translation
      ? `<xhtml:link rel="alternate" hreflang="${article.lang}" href="${abs(paths.article(article))}"/>` +
        `<xhtml:link rel="alternate" hreflang="${translation.lang}" href="${abs(paths.article(translation))}"/>`
      : '';
    entries.push(`<url><loc>${abs(paths.article(article))}</loc><lastmod>${article.updatedAt}</lastmod>${alternates}</url>`);
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    entries.join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
