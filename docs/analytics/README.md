# SoundKit measurement

## Anonymous browser analytics

`@soundkit/analytics` supplies a shared, code-owned client for SoundKit and
SoundKit Bio. It speaks the currently deployed Traks collector protocol without
loading the vendor script, whose automatic path and link collection cannot redact
profile handles or signed URLs. Collector changes must be compatibility tested.

The client only runs on the production domains. Its random session identifier
exists in page memory: refreshing, opening another tab, or crossing from Bio to
SoundKit starts a separate session. It reads/writes no tracking cookies, local
storage, or session storage. Requests omit credentials and referrers. Authentication
and playback persistence are separate product functions.

Routes become templates before collection. Query strings, user IDs, profile
handles, raw links, arbitrary search terms, and names are never analytics
properties. The event registry accepts only per-event, bounded scalar values.
Unknown events/properties are discarded. Outbound clicks retain destination
categories, never destination URLs. Visible engagement is attributed to the
previous route before navigation. Transport errors never block product actions.

This intentionally trades cross-session retention, cross-site attribution,
per-artist reports, and arbitrary UTM campaigns for a smaller privacy surface.
Page-memory sessions are not unique accounts or reliable daily active users.
No browser scheme can measure authenticated retention without some form of
linkage. Do not work around these limits with fingerprinting.

## Event semantics

- Playback starts use actual `playing` callbacks, not clicks; pauses/resumes do
  not count as new starts. Ended callbacks measure completion, not royalty eligibility.
- Video provider is bounded to SoundKit, Mux, or YouTube. Media transition events
  require observed playback of a different media type in the same page session.
- `artist_profile_saved`, `track_saved`, and `artist_followed` follow successful
  API responses. Bio follow currently measures CTA intent only; its existing local
  follow toggle does not prove a persisted follow.
- `track_upload_completed` means the upload API accepted the track; it does not
  prove asynchronous transcoding, publishing, or moderation completed.
- `checkout_started` requires a returned checkout URL/client secret. A click, client
  redirect, or premium entitlement is never a paid conversion. Premium entitlement
  confirmation uses `premium_access_confirmed`.
- Bio handoff completion requires a verified session response. Tipping checkout
  initialization is distinct from a settled tip.
- Client playback events cannot establish payable streams, ad revenue, purchase
  revenue, refunds, transfers, or creator balances. Use server accounting records.

## Traks configuration

`traks-manifest.json` records the implemented conversion goals and same-session
funnels for both sites. Historical configuration is retained. New configuration
is added idempotently; existing funnel names are not silently overwritten.

```sh
# Read-only comparison; supply credentials through your secret manager/environment.
node scripts/sync-traks.mjs
# Create missing conversions and funnels.
node scripts/sync-traks.mjs --apply
```

The command requires `TRAKS_API_TOKEN`. Never commit it or pass it as a CLI
argument. It validates the authenticated site ID/domain before creating objects.
Run again after applying: both sites should report zero missing objects. Goal
creation is configuration, not evidence that a conversion has occurred.

Funnels use events where profiles share normalized routes. They cannot follow a
visitor between Bio and SoundKit or across full-page checkout redirects. Measure
long-lived creator activation and billing from authoritative server state.

## Server data foundation: remaining work

A durable financial export is a separate change, not part of browser instrumentation.
The implementation should use a transactional outbox beside authoritative orders,
payments, payouts, ad accounting, and qualified streams, with stable event IDs,
schema versions, idempotent replay, retries, reconciliation, and retention controls.
Cloudflare Basin Pipelines plus an R2-backed lake is an export destination; it must
not replace the ledger. Queue delivery is at least once. Browser events must never
be promoted into financial truth.

Add business-specific operational events (battle votes, room participation, upload
processing, Open Verse, fulfillment and challenge outcomes) at their server success
boundaries, with contracts and matching goals when exposed anonymously. They are
not claimed as implemented by this browser foundation. Keep chat bodies and media
metadata out of the anonymous event stream.

## Database review

PlanetScale Insights was inspected read-only for `rocktownlabs/soundkit/main`.
An authenticated Insights-only MCP server is configured; this active process does
not expose its newly registered tools, so the first evidence collection used the
authenticated official `pscale` CLI. No production schema changes were applied.

The one-day snapshot showed approximately 51.5 seconds across 846 executions of a
schema introspection pattern (about 90.7% of reported query time). The production
deploy workflow runs Drizzle schema push. This is maintenance traffic; it should
not be presented as 90% of customer request latency.

Artist discovery separately repeats qualified-play subqueries in projections,
ordering, and cursor predicates. Optimize once per artist or as a grouped aggregate
and compare ranking/cursor results on local fixtures before shipping. This is an
application change, not a justification for dropping tables.

Some old unused-table recommendations name tables currently used by payments and
artists. Do not apply them wholesale. Live `search_embeddings` indexes include the
primary key, entity/model uniqueness and organization index, but no ANN index.
Keep existing pgvector. Benchmark representative vectors and filter patterns
before selecting an ANN index or changing recall/latency tradeoffs.

## Review completion

The CI Kimi review keeps a 700k token cap for up to 20 changed files and a 1.4m
cap for larger PRs, with a 35-minute job timeout. A reached budget, skipped
selection or unpublished finding still fails the existing completion gate.
Standalone reviews can deliberately use `--max-tokens-budget 1400000` or review
small groups through the CLI's exclude patterns; retain each report and inspect
its coverage. A partial review is not approval.

The server outbox/export rollout is tracked separately in
[#500](https://github.com/Rocktown-Labs/mysoundkit/issues/500).
