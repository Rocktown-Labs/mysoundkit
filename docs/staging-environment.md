# Isolated staging data (#513 / #517)

Target: PlanetScale `rocktownlabs/soundkit/staging`, a separate nonproduction
Postgres branch. The initial PS-DEV account catalog quote was $15/month before
storage/usage. This is one persistent staging branch, not one database per PR.
No production backup or customer data is restored into it.

## Credentials and authority

The GitHub `staging` environment holds:

- `DATABASE_URL`: staging runtime role with read/write access.
- `MIGRATION_DATABASE_URL`: separate staging schema role.
- `SOUNDKIT_E2E_ARTIST_EMAIL` / `SOUNDKIT_E2E_ARTIST_PASSWORD`.
- `SOUNDKIT_E2E_FAN_EMAIL` / `SOUNDKIT_E2E_FAN_PASSWORD`.
- `SOUNDKIT_E2E_COLLABORATOR_EMAIL` / `SOUNDKIT_E2E_COLLABORATOR_PASSWORD`.

Credentials are supplied privately, never printed or committed. The scripts do
not load `apps/server/.env` or fall back to production connections. The app role
can invoke required analytics functions and read the identity marker, but cannot
create objects in the public schema. Table and sequence access in public and
analytics comes from the explicitly provisioned `pg_read_all_data` and
`pg_write_all_data` inherited roles; schema/function grants alone are not the
complete authority model. Provider keys and production credentials
are not supplied by the fixture setup.

PlanetScale's connection username can differ from PostgreSQL `current_user`.
Bootstrap derives the actual runtime role from `DATABASE_URL` for grants; do not
copy a routing username from a connection URL into a PostgreSQL GRANT statement.

## First installation

1. Build the public schema in an isolated local/CI PostgreSQL+pgvector fixture
   using the reviewed repository schema. Export schema only (no data):

   ```sh
   pg_dump "$SOUNDKIT_TEST_DATABASE_URL" --schema-only --schema=public \
     --no-owner --no-privileges > public-schema.sql
   ```

   Verify that the fixture connection is local before running the export. In CI,
   use pg_dump inside the PostgreSQL service container so its major version
   matches the server. This export must not come from production.

2. Fingerprint the normalized baseline without database credentials:

   ```sh
   node scripts/staging-bootstrap.mjs --schema-file public-schema.sql --fingerprint
   ```

3. With both staging connection secrets injected, apply that exact baseline:

   ```sh
   node scripts/staging-bootstrap.mjs \
     --target rocktownlabs/soundkit/staging \
     --schema-file public-schema.sql \
     --schema-sha256 REVIEWED_NORMALIZED_SHA256 \
     --source-commit REVIEWED_SCHEMA_COMMIT
   ```

   Bootstrap rejects other targets, malformed identifiers/hash input, and a
   database already containing application state without the matching staging
   marker. It installs public schema, vector, the existing fingerprinted
   analytics schema, and `soundkit_environment.identity` in one transaction.
   The transaction owns its advisory lock and local statement/lock timeouts;
   no pooler-incompatible startup setting is sent. It strips dump metadata and
   duplicate capture triggers, then installs capture from its reviewed SQL.
   Existing staging is verified rather than overwritten. This is a bootstrap,
   not a migration/reset command for an existing application database.

4. Set `SOUNDKIT_DATABASE_TARGET=rocktownlabs/soundkit/staging` and
   `SOUNDKIT_MEDIA_BUCKET_NAME=soundkit-media-staging`, inject the private fixture
   passwords (32-128 characters), then run:

   ```sh
   node scripts/staging-fixtures.mjs
   ```

   Seeding verifies the actual connected marker, uses the installed Better Auth
   password implementation, and refuses to replace an existing identity or
   implicitly rotate a password. Repeating it with the same credentials does not
   duplicate records. It makes no provider requests and creates no payments,
   refunds, purchases, transfers or payouts.

## Synthetic catalog

Permanent seed identities are `staging-fixture-v1-{artist,fan,collaborator}`,
with reserved `@example.test` emails. The GitHub email secrets must exactly match
`soundkit-fixture-artist@example.test`, `soundkit-fixture-fan@example.test` and
`soundkit-fixture-collaborator@example.test`, respectively. The artists have Arkansas profiles; the
fan has a Texas profile. Each artist owns its own synthetic workspace. These
are fixtures, not real accounts or evidence of real creator activity.

Tracks are `staging-fixture-v1-track-{free,paid,private}`. Their separate media
object keys are:

- `staging-fixtures/v1/free.wav`
- `staging-fixtures/v1/paid.wav`
- `staging-fixtures/v1/private.wav`
- `staging-fixtures/v1/paid-preview.wav`

**Asset rows do not prove playback.** Upload the generated test tones only to the
isolated nonproduction bucket and verify playback/authorization before declaring
the staging journey operational. No fixture points to production media objects.
Permanent fixtures should not be mutated by destructive journey tests; those
create their own run-scoped records. Cleanup must be scoped to those records.

## Cutover status and gates

Data preparation alone does not isolate an existing preview. Before switching
preview bindings, finish isolated media/provider configuration, cookie/session
namespacing, and actual database preflight enforcement. Keep production resource
names and current bindings intact. A failed staging check must not trigger a
production repair or a broad teardown.

Browser analytics already limits production Traks collection to exact production
hostnames; retain that behavior. Server analytics on staging is test data in the
isolated staging database. Never enable the old real-backend E2E job with its
production URL defaults as part of this setup.

Future staging schema updates need reviewed migrations; the initial bootstrap
must not be repeatedly used to overwrite existing state. The separate broad
security audit remains paused.


The schema file and its expected fingerprint are trusted administrative inputs
that must be reviewed together. The schema-only regex is a sanity check, not a
SQL sandbox; never pass an untrusted dump or automatically approve its hash.
The reviewed baseline legitimately contains ALTER TABLE constraints and functions.

Repeat seeding preserves existing profile edits and credential hashes. It repairs
only the defined synthetic tracks' workspace association and preview asset shape;
it does not reset staging, rotate passwords or truncate tables. A conflicting
non-fixture genre slug intentionally reuses the shared genre taxonomy. Previews
are variant_audio with preview metadata linked to their master, never a second
master candidate. Actual anonymous preview delivery is a separate journey from
paid-master denial and is not claimed by fixture preparation.
