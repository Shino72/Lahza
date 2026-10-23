#!/usr/bin/env bash
# Restores a backup made by scripts/backup.sh into a project whose schema was
# created from supabase/migrations (for example a new Supabase project after
# `supabase db push`). Existing rows in the restored tables are replaced.
#
# Usage: scripts/restore.sh backup-<timestamp>.tar.gz.enc
# Environment: SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SECRET_KEY, BACKUP_PASSPHRASE
set -euo pipefail

: "${1:?backup file}" "${SUPABASE_DB_URL:?}" "${SUPABASE_URL:?}" "${SUPABASE_SECRET_KEY:?}" "${BACKUP_PASSPHRASE:?}"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$1" -out "$work/backup.tar.gz"
tar -C "$work" -xzf "$work/backup.tar.gz"

{
  cat <<'SQL'
set session_replication_role = replica;
truncate public.audit_events, public.ad_inquiries, public.site_settings, public.breaking_ticker,
  public.homepage_slots, public.article_tombstones, public.article_revisions, public.articles,
  public.media_assets, public.categories, public.staff_invitations, public.staff_permissions,
  public.staff_profiles, public.role_permissions, public.permissions cascade;
delete from storage.objects where bucket_id in ('media-private', 'media-public');
delete from auth.mfa_factors;
delete from auth.identities;
delete from auth.users;
SQL
  cat "$work/data.sql"
} | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f -

for bucket in media-private media-public; do
  [ -d "$work/storage/$bucket" ] || continue
  (cd "$work/storage/$bucket" && find . -type f | sed 's|^\./||') | while IFS= read -r name; do
    curl -sf -X POST -H "Authorization: Bearer $SUPABASE_SECRET_KEY" -H "apikey: $SUPABASE_SECRET_KEY" \
      -H "Content-Type: image/webp" -H "x-upsert: true" \
      --data-binary "@$work/storage/$bucket/$name" "$SUPABASE_URL/storage/v1/object/$bucket/$name" > /dev/null
  done
done
echo "restore complete"
