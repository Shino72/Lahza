# Operations

## Daily publishing

1. Dashboard → **New article**: language, headline, summary, text blocks, main image (upload or pick from the library), category.
2. **Save** keeps a draft. Journalists use **Submit for review**.
3. Editors and above: **Publish now**, or set a Cairo time and **Schedule**.
4. **Unpublish** removes the article from the site; **Archive** removes it and answers `410 Gone` at its old address.
5. Link the Arabic and English versions with *Other-language version*.
6. Homepage order and the breaking-news ticker: Dashboard → **Homepage & breaking**.

Public pages are cached for up to about a minute, so changes may take that long to appear.

## Staff

- Invite from Dashboard → **Staff**; invitations expire after 72 hours and can be revoked.
- Roles: Manager, Editor, Journalist. Extra permissions (for example `media.manage`) can be granted individually; nobody can grant what they do not hold.
- Suspend an account to block access immediately; articles and audit history are kept.

## Backups

- `.github/workflows/backup.yml` runs daily once enabled (see DEPLOYMENT.md §5) and keeps encrypted backups as workflow artifacts for 30 days.
- A backup contains the database rows (articles, staff, settings, inquiries, audit log, auth users and MFA factors) and every uploaded image, encrypted with AES-256 using `BACKUP_PASSPHRASE`.
- Without the passphrase a backup cannot be read or restored. Keep it in a password manager and offline.
- Supabase Pro adds daily managed backups; the scripts work with either plan.

### Restore

1. Create or choose the target Supabase project and apply migrations (DEPLOYMENT.md §1.2).
2. Download the artifact from GitHub Actions.
3. From a computer with PostgreSQL 17 client tools:

   ```sh
   SUPABASE_DB_URL=... SUPABASE_URL=... SUPABASE_SECRET_KEY=... BACKUP_PASSPHRASE=... \
     scripts/restore.sh backup-<timestamp>.tar.gz.enc
   ```

4. Open the site and the dashboard and check recent articles.

Restore was verified locally (backup → wipe → restore): row counts matched, a published article and its image were served again, and a restored account could sign in.

## Key rotation

Supabase → Project Settings → API keys: create a new secret key, set it in Vercel and GitHub secrets, redeploy, then revoke the old key. Rotate after any suspected exposure and when staff with access to provider dashboards leave.
