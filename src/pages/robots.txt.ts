import type { APIRoute } from 'astro';
import { getRepository } from '../lib/server/content';

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('`site` must be configured to build robots.txt');
  // Preview builds serve sample content and must stay out of search engines.
  const body =
    getRepository().kind === 'demo'
      ? 'User-agent: *\nDisallow: /\n'
      : `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${new URL('/sitemap.xml', site)}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
