# Security

## Model

- **Authentication:** Supabase Auth with email and password; public sign-up is disabled. Staff join only through invitations; the first Owner through a one-time, token-protected setup. TOTP MFA is required for Owner, Manager and Editor, and for any account holding extra permissions.
- **Sessions:** server-side only, in `HttpOnly`, `SameSite=Lax`, `Secure` (over HTTPS) cookies. No Supabase client runs in the browser.
- **Authorisation is enforced in the database.** Every table has row level security; nothing is readable or writable unless a policy allows it. `private.has_perm()` checks the caller's active account, role, explicit grants and MFA level. The dashboard UI only mirrors these rules.
- **Editorial workflow** (Draft → In review → Approved → Published → Archived) is enforced by a trigger on `articles`; journalists cannot publish even through direct API calls.
- **Staff management** goes through `SECURITY DEFINER` functions that refuse self-changes, Owner changes, and granting permissions the caller does not hold. A unique index allows only one Owner.
- **Privileged key:** `SUPABASE_SECRET_KEY` is read at runtime on the server and used only after the user's action has been authorised (invite emails, suspensions, publishing images, inquiries, rate limits, auth audit events).
- **Audit trail:** `audit_events` is append-only, including for the service role.

## Controls

| Threat | Control |
|---|---|
| Privilege escalation / IDOR | RLS policies, workflow trigger, staff functions; tested via direct API calls |
| Account takeover | MFA, password policy, rate limits per IP and per email, generic login errors |
| CSRF | Astro `checkOrigin` rejects cross-site form posts; `SameSite=Lax` cookies |
| XSS | Articles are structured blocks rendered with escaping (no stored HTML); CSP without `unsafe-inline` |
| Malicious uploads | Images are decoded (not trusted by name or type), size/dimension limited and re-encoded to WebP; random file names; private bucket until published |
| Draft leakage | Anonymous reads limited to `status = 'published' and publish_at <= now()` |
| Spam on the inquiry form | Server validation, honeypot, database-backed rate limit, optional Turnstile |
| Leaked secrets | No secrets in code; `.env*` ignored; GitHub secret scanning and Dependabot |
| Clickjacking / sniffing | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, HSTS |

## Tested

- `npm run test:integration` — database access with anonymous, journalist, editor (with and without MFA), manager and suspended accounts; deletion safeguards.
- `npm test` — upload validation (disguised HTML/SVG, oversized files and dimensions, metadata stripping), helpers.
- `npm run test:e2e` — full newsroom workflow, every Owner management action, forged publish attempt, suspension, inquiry storage, setup token rejection.

## Known limitations

- A suspended user's existing access token stays valid at the auth layer until it expires (database access is denied immediately).
- Images used by scheduled articles become public when the article is scheduled, before its publish time (random, unguessable URLs).
- Supabase Free projects pause after a week of inactivity and include no automatic backups; see `OPERATIONS.md`.
- Google sign-in is implemented but not covered by automated tests.
- Public pages are cached by the CDN for up to about two minutes, so an unpublished article can remain visible for that long.
- No system is unbreakable; report suspected issues privately to the Owner.

## Reporting

Email the Owner (address on the Contact page) with details. Do not open public issues for vulnerabilities.

## Incident response

1. Suspend affected staff accounts (Dashboard → Staff).
2. Rotate the Supabase secret key (Supabase → API keys), update Vercel, redeploy.
3. Review `audit_events` and Supabase auth logs.
4. Restore from backup if data was altered (`OPERATIONS.md`).
