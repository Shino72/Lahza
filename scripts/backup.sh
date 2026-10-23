#!/usr/bin/env bash
# Encrypted backup of the Lahza database and uploaded images.
#
# Required environment:
#   SUPABASE_DB_URL        Postgres connection string (Session pooler or direct), from the Supabase dashboard
#   SUPABASE_URL           Project URL
#   SUPABASE_SECRET_KEY    Server key, used only to download storage objects
#   BACKUP_PASSPHRASE      Long random passphrase; keep a copy outside GitHub
# Output: backup-<timestamp>.tar.gz.enc in the current directory.
set -euo pipefail

: "${SUPABASE_DB_URL:?}" "${SUPABASE_URL:?}" "${SUPABASE_SECRET_KEY:?}" "${BACKUP_PASSPHRASE:?}"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Data only: the schema is recreated from supabase/migrations.
pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges \
  --table='public.*' \
  --table=auth.users --table=auth.identities --table=auth.mfa_factors \
  --table=storage.objects \
  --exclude-table=public.rate_limits \
  > "$work/data.sql"

mkdir -p "$work/storage"
for bucket in media-private media-public; do
  psql "$SUPABASE_DB_URL" -At -c "select name from storage.objects where bucket_id = '$bucket'" |
    while IFS= read -r name; do
      [ -n "$name" ] || continue
      mkdir -p "$work/storage/$bucket/$(dirname "$name")"
      curl -sf -H "Authorization: Bearer $SUPABASE_SECRET_KEY" -H "apikey: $SUPABASE_SECRET_KEY" \
        "$SUPABASE_URL/storage/v1/object/$bucket/$name" -o "$work/storage/$bucket/$name"
    done
done

tar -C "$work" -czf "$work/backup.tar.gz" data.sql storage
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_PASSPHRASE \
  -in "$work/backup.tar.gz" -out "backup-$stamp.tar.gz.enc"
echo "backup-$stamp.tar.gz.enc"
