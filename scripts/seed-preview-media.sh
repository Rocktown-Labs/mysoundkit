#!/usr/bin/env bash
# Seed a preview-stage R2 bucket with media objects that exist in the
# production bucket but are referenced by the shared application database.
#
# Usage: SEED_PR_NUMBER=75 ./scripts/seed-preview-media.sh
#
# Required environment:
#   SEED_PR_NUMBER          Preview PR number (target bucket suffix).
#   DATABASE_URL            Shared PlanetScale Postgres connection string.
#   CLOUDFLARE_API_TOKEN    API token with R2 read/write on both buckets.
#   CLOUDFLARE_ACCOUNT_ID   Cloudflare account ID.
#
# Optional environment:
#   SOURCE_BUCKET           Defaults to "soundkit-media".

set -uo pipefail

SOURCE_BUCKET="${SOURCE_BUCKET:-soundkit-media}"
TARGET_BUCKET="soundkit-media-pr-${SEED_PR_NUMBER:?SEED_PR_NUMBER is required}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required to list asset object keys." >&2
  exit 1
fi

key_list_file="${WORK_DIR}/keys.txt"

psql "${DATABASE_URL/sslmode=verify-full/sslmode=require}" \
  --no-align --tuples-only --set="ON_ERROR_STOP=1" \
  --command="
    select distinct object_key
      from track_assets
     where object_key is not null
       and (bucket_name is null or bucket_name = '${SOURCE_BUCKET}')
    union
    select distinct object_key
      from project_assets
     where object_key is not null
       and (bucket_name is null or bucket_name = '${SOURCE_BUCKET}');
  " | sed '/^[[:space:]]*$/d' > "$key_list_file"

total_keys="$(wc -l < "$key_list_file" | tr -d '[:space:]')"
echo "Found ${total_keys} referenced object key(s) to sync into ${TARGET_BUCKET}."

copied=0
skipped=0
failed=0

while IFS= read -r key; do
  file="${WORK_DIR}/object.bin"
  rm -f "$file"
  if ! pnpm exec wrangler r2 object get "${SOURCE_BUCKET}/${key}" --file "$file" --remote >/dev/null 2>&1; then
    skipped=$((skipped + 1))
    echo "SKIP (missing in source) ${key}"
    continue
  fi

  content_type="$(file -b --mime-type "$file")"
  put_args=(r2 object put "${TARGET_BUCKET}/${key}" --file "$file" --remote)
  if [[ -n "$content_type" && "$content_type" != "application/octet-stream" ]]; then
    put_args+=(--content-type "$content_type")
  fi

  if pnpm exec wrangler "${put_args[@]}" >/dev/null 2>&1; then
    copied=$((copied + 1))
    echo "COPIED ${key} ($(wc -c < "$file" | tr -d '[:space:]') bytes)"
  else
    failed=$((failed + 1))
    echo "FAILED ${key}" >&2
  fi
done < "$key_list_file"

echo ""
echo "Seed complete: ${copied} copied, ${skipped} skipped (missing in source), ${failed} failed out of ${total_keys} key(s)."

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
