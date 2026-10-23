# Lahza | لحظة

Arabic-first, bilingual (Arabic/English) news site with a newsroom dashboard. Astro (server-rendered, TypeScript) on Vercel; Supabase for Postgres, authentication and image storage.

- Public site: `/ar/` (RTL, default) and `/en/` (LTR) — homepage, ten categories, articles, search, advertising page, about, privacy, sitemap.
- Dashboard: `/admin/` — articles and editorial workflow, images, homepage order, breaking-news ticker, categories, site settings, advertising inquiries, staff and permissions, audit log.

Setup and hosting: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · Security model: [docs/SECURITY.md](docs/SECURITY.md) · Publishing, backups, restore: [docs/OPERATIONS.md](docs/OPERATIONS.md)

## Local development

Requirements: Node.js 22.12+, Docker (for the local Supabase stack).

```sh
npm ci
npx supabase@2.120.0 start          # local Postgres, Auth, Storage and a mail inbox (http://127.0.0.1:54324)
npx supabase@2.120.0 status -o env  # copy API_URL / ANON_KEY / SERVICE_ROLE_KEY into .env (see .env.example)
npm run dev                         # http://localhost:4321
```

Without Supabase variables the site runs on labelled sample content (`src/content/demo/`), marked `noindex`.

Create a local Owner by setting `OWNER_SETUP_TOKEN` in `.env` and opening `/admin/setup/`; the invitation email arrives in the local inbox.

## Checks

```sh
npm run check              # Astro + TypeScript
npm test                   # unit tests
npm run test:integration   # database access control (needs the local stack and SUPABASE_* variables)
LAHZA_ADAPTER=node npm run build && npx supabase@2.120.0 db reset && npm run test:e2e
```

The end-to-end suite runs the sample-content site on port 4322 and, when `SUPABASE_*` and `OWNER_SETUP_TOKEN` are set, the full newsroom workflow on port 4321 against a freshly reset database. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an installed Chromium.

## Layout

```
src/pages/[lang]/         public routes (server-rendered)
src/pages/admin/          dashboard and sign-in flows
src/middleware.ts         sessions, dashboard access gate, cache and security headers
src/lib/server/           Supabase clients, content repository, media, rate limits
src/content/              content types, visibility rules, sample fixtures
supabase/migrations/      schema, RLS policies, workflow triggers, reference data
supabase/templates/       invite and password-reset emails
tests/{unit,integration,e2e}
scripts/backup.sh, restore.sh
```
