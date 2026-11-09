# Preview environments and database schema safety

SoundKit pull-request Workers use the synthetic staging PlanetScale database and private staging media bucket. Each PR has its own web/API/Bio domains and cookie namespace. These previews share staging data, not production data; they are not separate databases per PR. The preview workflow deploys and checks all three surfaces. Older, closed previews may still exist until cleanup; do not use their legacy `*.mysoundkit.com` URLs for testing.

## Safety policy

- Pull-request workflows **must not** run `drizzle-kit push`, execute migrations, or otherwise synchronize a branch-local schema against the shared staging database.
- Application deployment jobs never synchronize production schema. The production job checks the reviewed public-schema baseline read-only before deploying the matching Worker; see [database releases](database-releases.md).
- Database changes must use an expand-and-contract rollout. Add nullable columns, tables, or compatible enum values before code requires them; remove old fields only in a later release after every deployed Worker has stopped using them.
- A preview must never assume that another open PR's unmerged schema remains installed.

This prevents an older branch from deleting or reverting columns introduced by a newer branch.

## Testing a schema-changing pull request

1. Generate and review the migration under `packages/db/src/migrations/`.
2. Run the migration and application against a local or isolated test database.
3. Keep application reads and writes compatible with the deployed staging schema and production schema. A schema-changing PR needs its own reviewed isolated database/migration test; ordinary previews never apply its schema.
4. Run the normal preview for schema-independent browser coverage.
5. Merge only after review and verification. A separately reviewed and explicitly approved migration must already be applied compatibly before the matching application release; the deploy job checks but never applies schema.
6. For a change that cannot be tested without its new schema, provision an isolated database or database branch and point only that PR's deployment at it. Do not apply the schema to the shared database from the PR workflow.

## Monitoring

Sentry events use `production` for the production stage, `development` locally, and the Alchemy stage name such as `pr-83` for pull-request previews. A `soundkit-web-pr-*`, `bio-pr-*`, or `api-pr-*` URL is not a production request even if it uses production-like data.

## Incident recovery

If a stale preview has already changed the shared schema:

1. Stop further preview schema synchronization.
2. Identify the exact missing or changed fields from the failing Worker query.
3. Restore only reviewed, additive schema changes from the owning branch.
4. Redeploy the affected preview after restoration.
5. Exercise the failed endpoints directly before resuming feature testing.

## Isolation cutover (#513, #515)

The existing shared database/media policy above remains in effect until staging
is provisioned and cut over. Resource names alone do not establish isolation.
CI currently runs `scripts/deployment-preflight.mjs` in **report** mode: unsafe
bindings produce `passed:false` with bounded reason codes, but do not break the
existing preview while replacement resources are being prepared.

The shared environment manifest in `packages/infra/deployment-environment.mjs`
recognizes prod, staging, pr-N and local development. Local development takes
precedence over a prod profile for analytics and scheduled jobs. Current remote
production names and bindings are unchanged.

Before switching to enforce mode:

1. Create a nonproduction database from reviewed schema and synthetic fixtures;
   use one persistent staging branch initially and cap temporary PR branches.
2. Create private nonproduction media storage and provider sandboxes/sinks.
3. Install `soundkit_environment.identity` **only in nonproduction**, with one
   row `{singleton:true,target:'rocktownlabs/soundkit/staging'}` (or its exact
   isolated pr-N target). Grant the staging app read access to this marker.
4. Point `SOUNDKIT_DATABASE_TARGET`, `SOUNDKIT_MEDIA_BUCKET_NAME` and the actual
   database/media bindings at those resources. Set external effects disabled;
   do not bind real email or fulfillment credentials. Use only test Stripe keys.
5. Run `node scripts/deployment-preflight.mjs --stage staging --mode enforce
   --check-database`. This reads the marker from the actual connected database;
   a declared staging label alone cannot pass. Marker failure never triggers
   automatic DDL or prints connection credentials.
6. Make that enforcing check mandatory before deploy/resource mutations and
   remove production access from preview credentials. Keep production ownership
   and cleanup rules separate; never destroy production to test isolation.

This preflight covers the database/media/payment/side-effect boundaries above;
it is not proof of every provider's account permissions. Provider-specific
resource ownership and request adapters remain part of the staged cutover.
The report is redacted, and report-mode failure must not be called a healthy or
isolated environment. Bad stage/mode arguments always fail rather than default.

Readiness-only CI steps receive Stripe mode and credential-presence booleans,
not raw provider secrets. Preview deployment instead enforces actual database
identity and isolated configuration. Scheduling is derived from the shared manifest
for Worker bindings and cron registration; the report does not pretend to inspect
an independent scheduling override.

## Isolated staging rollout (#520)

`Deploy Isolated Staging` is a manual workflow using the `staging` environment.
It enforces the connected database marker before application resource changes,
then deploys only stage-owned resources. It never pushes a schema or adopts
production resources. After staging's real login/media checks passed, #534
switched new PR previews and their cleanup to the same GitHub `staging` environment with enforcing
identity checks before resource changes. Production secret recovery and
provider credentials are absent from preview jobs.

Staging web/API/Bio use `staging.soundkit.bio`, `api.staging.soundkit.bio` and
`bio.staging.soundkit.bio`. Isolated PRs use `pr-N.preview.soundkit.bio`,
`api.pr-N.preview.soundkit.bio` and `bio.pr-N.preview.soundkit.bio`. PR hosts are
outside staging's cookie parent. Production's API cookies remain on
`mysoundkit.com`, with existing names; each new stage has a distinct cookie
prefix and the narrowest shared parent needed for SSR. Native storage is keyed
by API origin, preserving the existing production storage prefix. A development
build switching origins must sign in again.

One persistent stage owns `soundkit-media-staging` and a bucket-scoped upload
token. Ordinary isolated PRs reference that owned resource instead of managing
it; teardown cannot delete the shared staging catalog. The media bucket is
private and retained. Recordings, queues, Durable Objects, workflows, telemetry
retain their per-stage identities. Isolated PRs reference staging’s existing
Hyperdrive configuration, avoiding another origin pool per PR. Containers are
capped to one instance outside production. These are shared synthetic staging
data, not a claim of per-PR database isolation.

Isolated Workers receive no runtime Cloudflare management token, production
Stripe/Mux/Google/OpenAI/RealtimeKit credentials, email or fulfillment credentials.
Unavailable optional integrations stay unavailable; mock realtime and disabled
scheduled jobs are explicit. The deployment process still requires the account
management token to provision resources. Dedicated staging auth/media signing
secrets live in the GitHub `staging` environment. Production credentials and
resource identities are unchanged.

The staging workflow uploads four generated WAV tones only to the exact staging
bucket and fixed fixture prefix after verifying the actual database marker.
The account token is used by this deployment-only script, never sent to a
browser or bound into the isolated Worker. Smoke checks verify signed cookie
login, cookie attributes, HTTP byte ranges, free playback, owner-only private
playback and denial of paid master playback for an unpaid fan/anonymous caller.
They do not manufacture a purchase or prove payment-provider integration.

The shared Hyperdrive connection explicitly disables SQL result caching while
retaining connection pooling. It serves authentication, permissions and purchase
access as well as public reads; Cloudflare does not invalidate cached SELECTs
after writes. The real staging smoke checks immediate rejection of the old
session cookie after logout. Public HTTP response caching remains a separate
policy. This favors correct authoritative reads over SQL-cache hit rates and can
increase origin read traffic; monitor database load after rollout.
Nonproduction Hyperdrive configurations use a soft origin connection limit of
five; staging PS-DEV has only 25 database slots and also needs administrative
and fixture connections. This is not a strict global connection guarantee.
Production's existing connection limit is unchanged.

Reference: [Hyperdrive read-after-write behavior](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/).

Each preview runs `node scripts/staging-smoke.mjs --stage pr-N` against its
custom-domain API before reporting deployment success. The synthetic artist/fan
checks enforce the PR cookie prefix/domain, real media ranges, restricted media
boundaries and immediate logout revocation. The script refuses production,
local and arbitrary-host targets. Browser checks use these same custom domains.

Closing a PR destroys its owned Workers/queues/recordings and drops its references
to staging media, upload credentials and Hyperdrive; those backing resources
belong to the persistent staging stage. Do not destroy staging while previews
reference it. The bucket remains retained even if staging is deliberately removed.

Rollback: disable `ENABLE_PREVIEW_DEPLOYS` and fix or revert the preview workflow
through a reviewed PR; redeploy the last known staging code if necessary. Retain
the staging database/media and keep production credentials out of preview jobs.
Never run production teardown to repair staging.

References: [Better Auth cookie scoping](https://better-auth.com/docs/concepts/cookies),
[Cloudflare multi-level custom-domain certificates](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[R2 token scope and S3 derivation](https://developers.cloudflare.com/r2/api/tokens/),
[deployment-only fixture object upload](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/upload/).
