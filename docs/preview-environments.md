# Preview environments and database schema safety

SoundKit pull-request Workers use isolated Cloudflare resources where practical, but currently share the production PlanetScale Postgres application database. Treat that database as production even when testing a `soundkit-web-pr-*`, `bio-pr-*`, or `api-pr-*` URL. The preview workflow deploys and checks all three application surfaces.

## Safety policy

- Pull-request workflows **must not** run `drizzle-kit push`, execute migrations, or otherwise synchronize a branch-local schema against the shared database.
- Application deployment jobs never synchronize production schema. The production job checks the reviewed public-schema baseline read-only before deploying the matching Worker; see [database releases](database-releases.md).
- Database changes must use an expand-and-contract rollout. Add nullable columns, tables, or compatible enum values before code requires them; remove old fields only in a later release after every deployed Worker has stopped using them.
- A preview must never assume that another open PR's unmerged schema remains installed.

This prevents an older branch from deleting or reverting columns introduced by a newer branch.

## Testing a schema-changing pull request

1. Generate and review the migration under `packages/db/src/migrations/`.
2. Run the migration and application against a local or isolated test database.
3. Keep application reads and writes backward-compatible with the currently deployed production schema whenever possible.
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
not raw provider secrets. Preview reports include only bindings that the preview
deploy actually receives. Scheduling is derived directly from the shared manifest
for Worker bindings and cron registration; the report does not pretend to inspect
an independent scheduling override.
