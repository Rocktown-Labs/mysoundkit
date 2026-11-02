# Authoritative analytics and event export (#500)

## Contract and ownership

Traks remains anonymous, cookieless product analytics. This pipeline is a separate,
restricted internal dataset. It does not add browser cookies or fingerprinting.
The operational payment ledger remains the financial source of truth.
The existing charge-refunded producer uses a charge ID and charge total rather
than individual Refund IDs/amounts. Those legacy-shaped rows are quarantined by
this pipeline and excluded from refund revenue until that producer is corrected;
nonzero rejects mean the archive must not be treated as a complete net-revenue
report. This does not repair or rewrite historical payment records.

PostgreSQL AFTER triggers insert a versioned outbox event in the **same transaction**
as successful payments, individual partial refunds, paid orders, purchase access,
subscription activation/trial access, ready track/video media, and published
tracks/projects/videos. Failed/aborted transactions leave no event. Existing
business guards still own payment state. Access or publication never implies revenue.
A unique source transition suppresses duplicate and delayed provider writes while
the event is retained. There is no historical backfill or synthetic revenue.

Each event has a random UUID retained across delivery retries and manual replay.
Export is **at least once**: a crash after durable ingestion but before acknowledgement
can redeliver. Consumers must deduplicate `event_id` before aggregation. Pipeline
file delivery guarantees do not deduplicate repeated calls to `send()`.

## Environment and privacy boundaries

Database connections identify their server deployment via `application_name`
(`soundkit/production`, `soundkit/pr-N`, or `soundkit/test`). Hyperdrive forwards
that startup parameter. Unknown/old clients are classified as test, never production.
Production cron only drains production events. Each Alchemy stage has a different
private R2 bucket, stream, sink and pipeline; preview cron remains disabled. No
HTTP/public stream ingestion, public bucket URL, or browser binding is enabled.

Only fixed scalar export fields are allowed: schema/producer/policy versions,
event UUID/type, deployment, UTC time, opaque subject UUID/cohort day, bounded kind,
integer minor-unit amount and ISO currency. Raw source keys, user IDs, emails,
URLs, tokens, IPs, provider payloads and arbitrary properties never leave Postgres.
Unknown properties or invalid money quarantine the event instead of silently
exporting them. UUID subject keys are pseudonymous internal data, not anonymous
Traks identifiers. Never send them to Traks.

The `soundkit_analytics` schema revokes PUBLIC access; the existing application DB
role owns it. Operational endpoints require an authenticated administrator. Do not
issue lake credentials to public clients. The sink receives an Alchemy-managed
R2 token scoped only to its stage's analytics bucket; it is not bound to the API
Worker. R2 objects are date-partitioned JSON, without per-user/per-track partitions.

## Delivery, failure and retention

The five-minute production schedule claims at most 100 due events with
`FOR UPDATE SKIP LOCKED` and a two-minute lease, then awaits one bounded stream
batch before acknowledging only the matching lease. Delivery failures use capped
exponential backoff and quarantine after ten attempts. Expired leases recover
without triggering payment, fulfillment, refund or payout code.

Admin endpoints under `/v1/admin/analytics`:

- `GET /health`: backlog, quarantine/reject counts, retry attempts, oldest pending
  age and maximum acknowledged delivery lag.
- `GET /failures`: first 50 quarantined IDs, type, timestamps, attempts and bounded
  failure code; source payloads are omitted.
- `POST /replay/:id`: release a retained event for redelivery with its **same ID**.
  Active leases cannot be reset. Replaying the failure list makes room for the
  next batch; invalid producer data must be corrected before replay.
- `GET /retention`: observed new-account UTC cohorts, D1/D7/D30 return counts,
  maturity flags, and daily signed-in activity. Successful authenticated API
  activity records once per account/day/deployment. A private per-PoP Cache API
  throttle uses hashed account/day keys for 15 minutes before another database
  attempt; media/HEAD/OPTIONS requests are excluded. Cache failures fall back to
  the authoritative database uniqueness/exclusion checks. This covers website, Bio,
  desktop and mobile calls without another identifier. It excludes anonymous
  visitors and pre-rollout historical cohorts. Erased accounts leave these cohorts.
- `GET /reconciliation`: observational checks for captured orders over the retained
  30-day window: settled-payment association, amount/currency mismatch, missing
  digital purchase access, and access on unpaid orders. At most 500 orders are
  checked; `truncated` and `next_cursor` make the limit explicit. Continue with
  `before_created_at` and `before_id` from the cursor to inspect older pages.
  Scheduled checks inspect the newest page and warn if pagination is needed.
  Physical-only items do not require a digital purchase row. This is not an audit
  of all historical Stripe invoices, payouts, disputes, taxes or subscriptions.

Structured logs: `analytics_export_batch`, `analytics_export_delivery_failed`,
`analytics_outbox_health`, `analytics_outbox_attention_required` (>10-minute backlog
or quarantine), `analytics_sweep_failed`, `analytics_reconciliation`,
`analytics_reconciliation_mismatch`, and `analytics_reconciliation_truncated`.
Use these for alerts; failures never silently count as a healthy zero backlog.

Delivered outbox data and private raw R2 files expire after 30 days. Pending events
older than 30 days become visibly expired/quarantined; quarantined rows expire at
90 days. Daily activity expires at 90 days; unused subject mappings are pruned
after 90 inactive days. Maintenance uses bounded 500-row batches. Exclusions
remain for the account lifetime. Authoritative commerce records have their own
existing business retention policy and are not deleted by analytics maintenance.

`DELETE /v1/analytics/account-data` is signed-in self-service analytics opt-out.
`POST /v1/admin/analytics/erase/:userId` is the administrative equivalent. A
per-account transaction lock serializes erasure against event/activity capture.
They delete activity/cohort linkage and the subject mapping, suppress future
identified activity, and detach retained business facts from the subject. Account
deletion also removes mappings through foreign keys. Already exported files lose
their account mapping immediately but physically expire under the 30-day R2 rule;
this is not a promise of immediate physical row deletion from archived files.

## Explicit migration and rollback

Production target: PlanetScale `rocktownlabs/soundkit/main` (Postgres).

The separate schema is excluded from automatic `drizzle-kit push` via explicit
`schemaFilter: ["public"]`. CI installs the migration only in its isolated local
PostgreSQL/pgvector service. Production deployment **checks** its fingerprint and
all ten enabled capture triggers before and after application schema push; deployment cannot auto-install it.

Review `packages/db/analytics/001_outbox.sql` and get its fingerprint:

```sh
node scripts/analytics-migration.mjs --fingerprint
```

After explicit approval of that fingerprint and production target, merge the PR
and dispatch the manual **Apply approved analytics migration** workflow on master:

```sh
gh workflow run analytics-migration.yml --ref master \
  -f migration_sha256=THE_APPROVED_SHA256
```

The workflow uses the existing production DATABASE_URL secret, verifies the exact
fingerprint, and installs atomically with a three-second lock acquisition timeout
and 30-second statement timeout. Any failure rolls back the transaction. Apply
before the new master deploy reaches its migration check. Otherwise the check
stops deployment safely; rerun deployment after successful installation. The old
application keeps running until deployment passes. No existing business table
rows are backfilled. AFTER triggers add transactional overhead; monitor database
write latency, connection errors, backlog and rejects after activation.

Non-destructive rollback: roll back the application release and execute the reviewed
`packages/db/analytics/001_disable.sql` against this same target. That file removes
only the ten capture triggers, marks the fingerprint disabled, and retains data.
No production table/column is dropped. The disabled fingerprint prevents an
accidental reactivation through deployment. Re-enabling after rollback requires a
new reviewed migration, not a forced replay of the original installer.

Migration requires the existing application/migration role to create schemas,
tables, functions and triggers; the owner is the same role used by Hyperdrive.
If the role lacks those rights, installation fails without partially applying.

The pinned Alchemy beta.79 sink provider has a narrow patch for incomplete
write-only credentials saved after a failed create. Planning requests replacement
instead of calling `Redacted.value(undefined)`; equal valid credentials still
produce no replacement, and credential rotation still replaces the sink. The
source and compiled provider are patched together and covered by executable
provider tests. This does not bypass Cloudflare authentication or alter the
production migration gate.

## Querying the archive

Use a controlled internal analytical reader (for example DuckDB over downloaded
JSON or authorized R2 access). See `lake-queries.sql`. Deduplicate by event ID,
group money by currency, and distinguish order/access events from actual settled
payments. The raw archive is bounded to 30 days; build reviewed aggregate tables
before needing longer financial trend history. Do not treat it as a replacement
for the operational ledger or use replay to execute business effects.

References: [Basin Worker ingestion](https://developers.cloudflare.com/basin-pipelines/streams/writing-to-streams/),
[R2 sink](https://developers.cloudflare.com/basin-pipelines/sinks/available-sinks/r2/),
[Hyperdrive connection identification](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/).
