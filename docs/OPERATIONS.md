# Operations

## Daily publishing

1. Dashboard → **New article**: language, headline, summary, text blocks, main image (upload or pick from the library), category.
2. **Save** keeps a draft. Journalists use **Submit for review**.
3. Editors and above: **Publish now**, or set a Cairo time and **Schedule**.
4. **Unpublish** removes the article from the site; **Archive** removes it and answers `410 Gone` at its old address.
5. Link the Arabic and English versions with *Other-language version*.
6. Homepage order and the breaking-news ticker: Dashboard → **Homepage & breaking**.

Public pages are cached briefly; changes (including unpublishing) reach readers within about two minutes.

## Staff

- Invite from Dashboard → **Staff**; invitations expire after 72 hours and can be revoked.
- Roles: Manager, Editor, Journalist. Extra permissions (for example `media.manage`) can be granted individually; nobody can grant what they do not hold.
- Suspend an account to block access immediately; articles and audit history are kept.

## What deletion does

| Item | Behaviour |
|---|---|
| Article | Published articles cannot be deleted; **Archive** first (keeps a 410 page). Drafts and archived articles can be deleted after typing `DELETE`; their revision history is deleted with them. Prefer Archive. |
| Image | Can be deleted only when unpublished and not used by any article. |
| Category | Cannot be deleted while it has articles; hide it instead. |
| Staff | Never deleted. Suspend instead; pending invitations can be revoked. |
| Inquiry | Deleted only after ticking the confirmation box; marking *Closed* or *Spam* keeps it. |
| Audit log | Cannot be edited or deleted by anyone, including the server. |

Anything deleted can only be recovered from a backup.

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

## Automated or not

| Task | Status |
|---|---|
| Daily encrypted backup | Automated **after** the secrets and `BACKUPS_ENABLED=true` are set (DEPLOYMENT.md §5); nothing runs until then |
| Backup before each migration | Automated in the *Database migrations* workflow when backups are enabled |
| Backup storage | GitHub Actions artifacts, 30 days; download copies you want to keep longer |
| Restore | Manual (`scripts/restore.sh`), from a computer |
| Managed backups / point-in-time recovery | Only on a paid Supabase plan |

## Recovering from a failed release

- **Site broken after a deploy:** Vercel → Deployments → last good deployment → **Promote to Production**. Data is not affected.
- **Migration failed:** each migration file runs in a single transaction, so a failed file changes nothing. Fix the file in a new commit and run the workflow again.
- **Migration applied but harmful:** do not edit applied migration files. Write a new migration that corrects it, or restore the pre-migration backup into the project (see Restore).
- The deployment never resets the database: Vercel only builds the site, and the migration workflow only applies pending files (`supabase db push`). Never run `supabase db reset` against production.

## Key rotation

Supabase → Project Settings → API keys: create a new secret key, set it in Vercel and GitHub secrets, redeploy, then revoke the old key. Rotate after any suspected exposure and when staff with access to provider dashboards leave.
