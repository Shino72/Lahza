# Deployment

## Current setup

- Hosting: Vercel project connected to this GitHub repository. Pushes to `main` deploy to production; other branches get preview URLs.
- Build: `npm ci` then `npm run build`; output directory `dist/` (see `vercel.json`).
- `/` redirects to `/ar/` at the edge.
- Security headers (CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are set in `vercel.json`.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Preview | Production |
|---|---|---|
| `PUBLIC_SITE_URL` | optional | the final domain, e.g. `https://www.example.com` |
| `LAHZA_CONTENT_SOURCE` | `demo` | `demo` until the database is connected |

While `LAHZA_CONTENT_SOURCE=demo`, every page is `noindex` and `robots.txt` disallows crawling, so sample stories cannot reach Google.

## Release

1. Work on a branch; Vercel builds a preview for each push.
2. Check the preview: homepage, a category, an article, search, advertising page, `/sitemap.xml`, `/robots.txt`, and response headers.
3. Merge to `main` only after approval.

## Rollback

In Vercel → Deployments, choose the last good production deployment and select **Promote to Production** (instant rollback). Then revert the offending commit on `main`.

## Hosting plan

Vercel's Hobby plan is limited to non-commercial personal use. A news site that sells advertising needs a plan that permits commercial use before launch; confirm current terms at https://vercel.com/docs/plans/hobby.

## Custom domain and Search Console (after approval)

1. Buy the domain (owner action).
2. Vercel → Project → Settings → Domains: add the apex and `www`; choose one as canonical and redirect the other.
3. Create the DNS records Vercel shows at the registrar. Vercel issues the HTTPS certificate automatically.
4. Set `PUBLIC_SITE_URL` to the canonical origin and redeploy.
5. Google Search Console: add a **Domain** property, add the TXT record it gives you at the registrar, verify, then submit `https://<domain>/sitemap.xml`.
6. Monitor Pages and Sitemaps reports. Indexing and ranking are controlled by Google and take time.
