# Lahza | لحظة

Arabic-first, bilingual (Arabic/English) news website built with [Astro](https://astro.build) and TypeScript.

## Status

| Area | State |
|---|---|
| Public site: homepage, 10 categories, article pages, search, advertising page, about, privacy | Working, static build |
| Arabic RTL / English LTR, language switch, `/ar/` and `/en/` URLs, linked translations | Working |
| Canonical, `hreflang`, Open Graph, NewsArticle JSON-LD, `sitemap.xml`, `robots.txt` | Working |
| Security headers and CSP (`vercel.json`) | Configured; verify on the deployed preview |
| Content | Sample fixtures only (`LAHZA_CONTENT_SOURCE=demo`); the site is `noindex` while they are in use |
| Database, staff login, roles, CMS, media uploads, inquiry storage | Not implemented yet (backend phase) |
| Advertising inquiry form | Rendered disabled until inquiries can be stored securely |

## Requirements

- Node.js 22.12 or later
- npm 10 or later

## Commands

```sh
npm ci                # install exact locked dependencies
npm run dev           # local dev server on http://localhost:4321
npm run check         # Astro + TypeScript diagnostics
npm test              # unit tests (Vitest)
npm run build         # static build into dist/
npm run test:e2e      # browser tests against the built site (Playwright)
```

`npm run test:e2e` serves `dist/`, so run `npm run build` first. To use an already-installed Chromium instead of `npx playwright install chromium`, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its path.

## Configuration

Copy `.env.example` to `.env` for local overrides. Never commit `.env` files.

| Variable | Purpose |
|---|---|
| `PUBLIC_SITE_URL` | Canonical origin for canonical links, `hreflang` and the sitemap |
| `LAHZA_CONTENT_SOURCE` | `demo` serves labelled sample fixtures; any other value serves an empty site until the database source exists |

## Project layout

```
src/config/site.ts        contact details, leadership, display time zone
src/content/              content types, categories, visibility rules, sample fixtures
src/i18n/                 UI strings (ar/en) and URL helpers
src/lib/                  search normalisation, SEO, sharing, inquiry validation
src/components/, layouts/ UI
src/pages/[lang]/         public routes
tests/unit, tests/e2e     Vitest and Playwright suites
```

Content visibility is defined once in `src/content/query.ts`: an article is public only when `status = 'published'` and `publishAt <= now`. The database policies added in the backend phase must keep the same rule.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment and rollback.
