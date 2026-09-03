# Preview environments and database schema safety

SoundKit pull-request Workers use isolated Cloudflare resources where practical, but currently share the production PlanetScale Postgres application database. Treat that database as production even when testing a `soundkit-web-pr-*` or `api-pr-*` URL.

## Safety policy

- Pull-request workflows **must not** run `drizzle-kit push`, execute migrations, or otherwise synchronize a branch-local schema against the shared database.
- Only the production deployment job applies the reviewed schema, before deploying the matching production Worker.
- Database changes must use an expand-and-contract rollout. Add nullable columns, tables, or compatible enum values before code requires them; remove old fields only in a later release after every deployed Worker has stopped using them.
- A preview must never assume that another open PR's unmerged schema remains installed.

This prevents an older branch from deleting or reverting columns introduced by a newer branch.

## Testing a schema-changing pull request

1. Generate and review the migration under `packages/db/src/migrations/`.
2. Run the migration and application against a local or isolated test database.
3. Keep application reads and writes backward-compatible with the currently deployed production schema whenever possible.
4. Run the normal preview for schema-independent browser coverage.
5. Merge only after review and verification. The production deployment applies the schema before deploying the new Worker.
6. For a change that cannot be tested without its new schema, provision an isolated database or database branch and point only that PR's deployment at it. Do not apply the schema to the shared database from the PR workflow.

## Monitoring

Sentry events use `production` for the production stage, `development` locally, and the Alchemy stage name such as `pr-83` for pull-request previews. A `soundkit-web-pr-*` or `api-pr-*` URL is not a production request even if it uses production-like data.

## Incident recovery

If a stale preview has already changed the shared schema:

1. Stop further preview schema synchronization.
2. Identify the exact missing or changed fields from the failing Worker query.
3. Restore only reviewed, additive schema changes from the owning branch.
4. Redeploy the affected preview after restoration.
5. Exercise the failed endpoints directly before resuming feature testing.
