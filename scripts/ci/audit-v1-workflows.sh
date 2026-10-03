#!/usr/bin/env bash
# Read-only audit of Cloudflare Workflow definitions and their instance states
# (see #363). Answers: which orphaned flat "soundkit-*" v1 definitions have
# drained (no queued/running/paused instances) and are safe to delete.
#
# Required environment:
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
#
# Endpoints (verified against @distilled.cloud/cloudflare's generated client):
#   GET /accounts/{account_id}/workflows
#   GET /accounts/{account_id}/workflows/{workflow_name}/instances?page&per_page

set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

API="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workflows"

cf() {
  curl -sS \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "$@"
}

cf "$API" > defs.json
if ! jq -e '.success != false' defs.json >/dev/null 2>&1; then
  echo "::error::listing workflow definitions failed:"
  jq . defs.json || cat defs.json
  exit 1
fi
total=$(jq '.result | length' defs.json)
echo "Workflow definitions in account: $total"
echo

printf '%-62s %-14s %-10s %-8s  %s\n' \
  "DEFINITION" "LIVE(q/r/p)" "ERRORED" "TOTAL" "VERDICT"
printf '%.0s-' {1..110}; echo

mapfile -t names < <(jq -r '.result[] | (.name // .id) | select(. != null and . != "")' defs.json)

for name in "${names[@]}"; do
  enc=$(jq -rn --arg v "$name" '$v | @uri')
  : > instances.jsonl
  page=1
  while :; do
    body=$(cf "$API/$enc/instances?page=$page&per_page=50")
    if ! count=$(printf '%s' "$body" | jq -r '.result | length // 0' 2>/dev/null); then
      echo "WARN: $name: unparsable instances response (page $page):"
      printf '%s' "$body" | head -c 500
      echo
      break
    fi
    [ "$count" -eq 0 ] && break
    printf '%s' "$body" | jq -c '.result[]?' >> instances.jsonl
    page=$((page + 1))
    if [ "$page" -gt 30 ]; then
      echo "WARN: $name: stopping pagination at page 30 (counts may be partial)"
      break
    fi
  done

  live=$(jq -s '[.[] | select(.status == "queued" or .status == "running" or .status == "paused")] | length' instances.jsonl)
  errored=$(jq -s '[.[] | select(.status == "errored")] | length' instances.jsonl)
  seen=$(jq -s 'length' instances.jsonl)

  era="v1-orphan"
  case "$name" in
    *Workflow*) era="v2-managed";;
  esac

  verdict=""
  if [ "$era" = "v2-managed" ]; then
    verdict="v2: live definition, not an orphan"
  elif [ "$live" -gt 0 ]; then
    verdict="DRAINING - wait for live instances"
  elif [ "$seen" -gt 0 ]; then
    verdict="drained - review errored, then safe to delete"
  else
    verdict="drained - safe to delete"
  fi

  printf '%-62s %-14s %-10s %-8s  %s [%s]\n' \
    "$name" "$live" "$errored" "$seen" "$verdict" "$era"
done

echo
echo "Notes:"
echo "- 'v1-orphan' = the flat soundkit-* definitions from the v1 stack; v2"
echo "  manages '{script}-{Class}-{hash}' names. Only v1-orphans can be deleted."
echo "- Read-only audit. Delete drained v1-orphans via the Cloudflare dashboard"
echo "  (Workers & Pages -> Workflows)."
