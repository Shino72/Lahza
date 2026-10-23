# Deployment and setup

Everything below is done in provider dashboards, and works from a phone browser. Secrets go into those dashboards only — never into the repository, chat, or email.

## First deployment checklist

1. ☐ **GitHub:** the code is on a branch of `Shino72/Lahza` (push, or upload the source ZIP).
2. ☐ **Supabase:** create the project; save the database password in a password manager (§1).
3. ☐ **GitHub secret** `SUPABASE_DB_URL` → Actions → **Database migrations** → Run workflow → green tick (§1.2).
4. ☐ **Supabase Auth:** sign-ups off, TOTP on, Site URL + Redirect URLs, email templates, SMTP (§1.3–1.7).
5. ☐ **Vercel variables:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `PUBLIC_SITE_URL`, `OWNER_SETUP_TOKEN` → Redeploy (§2).
6. ☐ **Check the preview:** home page shows "no stories yet" (not sample stories), `/robots.txt` lists the sitemap.
7. ☐ **Owner:** `/admin/setup/` → invitation email → password → authenticator app (§3).
8. ☐ **First login:** sign out, sign in at `/admin/login/` with password + 6-digit code; publish a test article, open it on the site, then archive it.
9. ☐ **Remove** `OWNER_SETUP_TOKEN` from Vercel → Redeploy.
10. ☐ **Backups:** add the backup secrets and `BACKUPS_ENABLED=true`, run **Backup** once manually, confirm an artifact appears (§5).
11. ☐ **Production:** merge to `main` only after steps 6–8 pass on the preview.

## 1. Supabase project

1. Create a project at <https://supabase.com/dashboard> (region close to Egypt, e.g. Frankfurt). Save the database password in a password manager.
2. **Apply the schema.** In GitHub → repository **Settings → Secrets and variables → Actions**, add `SUPABASE_DB_URL` (Supabase → **Connect** → *Session pooler* connection string, with the password filled in). Then open **Actions → Database migrations → Run workflow**. Re-run it whenever new files appear in `supabase/migrations/`.
   - Alternative from a computer: `npx supabase@2.120.0 db push --db-url "<connection string>"`.
3. **Authentication → Sign In / Providers**
   - *Allow new users to sign up*: **off**.
   - *Email* provider: **on**, *Confirm email*: on, *Secure password change*: on.
   - Minimum password length **12**, require lowercase, uppercase and digits.
4. **Authentication → Multi-Factor**: TOTP (App Authenticator) **enabled**.
5. **Authentication → URL Configuration**
   - Site URL: the public site origin, e.g. `https://lahza-tau.vercel.app` (later the custom domain).
   - Redirect URLs: `https://<site>/admin/auth/confirm/` and `https://<site>/admin/auth/callback/`.
6. **Authentication → Emails → Templates**: replace the *Invite user* and *Reset password* templates with the contents of `supabase/templates/invite.html` and `supabase/templates/recovery.html`. The links in those templates are required for sign-in to work.
7. **Authentication → Emails → SMTP Settings**: configure a real SMTP provider. Supabase's built-in sender is rate-limited and intended for testing only; invitations and password resets will not be reliable without it.
8. **Access token (JWT) expiry** (Project Settings → JWT Keys, or Authentication → Sessions): set to 900 seconds (suspensions take effect in the database immediately; a shorter token shortens the remaining window at the auth layer).

## 2. Vercel

Project → **Settings → Environment Variables** (Production and Preview):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key (or legacy `anon` key) |
| `SUPABASE_SECRET_KEY` | Secret key (or legacy `service_role` key) — mark *Sensitive* |
| `PUBLIC_SITE_URL` | The canonical origin, e.g. `https://lahza-tau.vercel.app` |
| `OWNER_SETUP_TOKEN` | 32+ random characters (only until the Owner exists) — *Sensitive* |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional, from Cloudflare Turnstile |
| `GOOGLE_LOGIN_ENABLED` | `true` only after step 4 |

Redeploy after changing variables. With `SUPABASE_*` set, the site serves database content and is indexable. Without them, preview deployments show labelled sample stories and production shows an empty site; both are `noindex`, so sample content can never be published as news.

Vercel's Hobby plan is for non-commercial use. Move to a plan that permits commercial use before the site carries advertising.

## 3. First Owner account

1. Open `https://<site>/admin/setup/`.
2. Enter the `OWNER_SETUP_TOKEN` value, your name and your own email address.
3. Open the invitation email, press **Continue**, choose a password, then scan the QR code with an authenticator app and enter the 6-digit code.
4. Delete `OWNER_SETUP_TOKEN` from Vercel and redeploy. The setup page refuses to run once an Owner exists, and the database allows only one Owner.

Staff are then invited from **Dashboard → Staff**. There is no public registration.

## 4. Google sign-in (optional, invited staff only)

1. Google Cloud Console → APIs & Services → **OAuth consent screen** (External, app name "Lahza").
2. **Credentials → Create OAuth client ID** (Web application). Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → **Google**: enable and paste the client ID and secret there.
4. Set `GOOGLE_LOGIN_ENABLED=true` in Vercel and redeploy.

Because sign-ups are disabled, Google sign-in only works for an email that was already invited; the dashboard additionally rejects any account without an active staff profile. Google sign-in has not been tested end to end in this repository's test suite (it needs real Google credentials) — test it with a staff account before relying on it.

## 5. Backups

Add the GitHub Actions secrets `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BACKUP_PASSPHRASE` (a long random passphrase, also stored offline), and `SUPABASE_DB_URL`; then add the Actions *variable* `BACKUPS_ENABLED=true`. See [OPERATIONS.md](OPERATIONS.md) for restore.

## 6. Custom domain and Google Search Console

1. Check availability and renewal price at a registrar (e.g. Cloudflare Registrar, Namecheap). Buying and DNS changes are owner decisions.
2. Vercel → Project → **Domains**: add `lahza.com` and `www.lahza.com`, choose one as primary and redirect the other.
3. Create the DNS records Vercel shows at the registrar. HTTPS certificates are issued automatically.
4. Update `PUBLIC_SITE_URL`, the Supabase Site URL and Redirect URLs to the new origin; redeploy.
5. Search Console → **Add property → Domain** → add the TXT record at the registrar → Verify → **Sitemaps** → submit `https://<domain>/sitemap.xml`.

Indexing and ranking are controlled by Google and take time.

## Release and rollback

- Work on a branch; Vercel builds a preview per push. Merge to `main` to release.
- Roll back from Vercel → Deployments → previous deployment → **Promote to Production**.
- Database migrations are forward-only; take a backup before running the migration workflow.
