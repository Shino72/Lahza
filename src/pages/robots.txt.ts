import type { APIRoute } from 'astro';
import { loadContent } from '../content/source';

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('`site` must be configured to build robots.txt');
  // Preview builds serve sample content and must stay out of search engines.
  const body =
    loadContent().kind === 'demo'
      ? 'User-agent: *\nDisallow: /\n'
      : `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap.xml', site)}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
