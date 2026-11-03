# Database release contract (#513 / #522)

Production application deployments are check-only. They do not run schema push,
create extensions, replay migrations or repair drift. Existing analytics capture
retains its separate fingerprinted, explicitly approved migration workflow.

## Baseline

`packages/db/releases/public-schema-baseline.json` records the reviewed schema
source files, current column inventory fingerprint, counts and source commit.
On 2026-11-03 a read-only PlanetScale main inventory matched the isolated local
fixture: 141 public tables, 1,544 column names/types/nullability definitions.
No production rows were queried or changed to establish this baseline. The old
Drizzle migration journal is historical evidence, not a replay instruction.

`node scripts/public-schema-contract.mjs` requires an explicit `DATABASE_URL`,
uses a read-only transaction, checks that source hashes match, checks the public
column fingerprint, and verifies vector is already installed. A mismatch blocks
application deployment while the current application keeps serving. It emits
bounded findings without connection/provider exception details.

The target label is the expected production target, not an independent identity
attestation. GitHub's production environment selects the credential. The staging
identity marker remains a separate nonproduction preflight. This baseline checks
columns, not every index, constraint, enum label, default, privilege or stored
function. Changes to those still require migration review and staging evidence;
a passing column check alone is not a full schema or security sign-off.

The source set recursively includes all non-test TypeScript schema modules and Drizzle's
configuration. New/removed/edited files require a reviewed manifest update.
Source hashes can change for a format-only edit without database changes; keep
the existing observed column hash and document why no migration is necessary.
Do not regenerate an expected column hash from an unexpected live schema merely
to make a failing deployment green.

## Future schema release

1. Create an issue and reviewed, versioned SQL artifact. Describe the exact target,
   expected effects, data/availability risks, rollback and post-change checks.
2. Test an upgrade from the previously deployed schema on isolated staging. Prove
   old and new application versions can coexist. Expand first; backfill in a
   bounded resumable job; remove fields in a later release. No blind old-journal
   replay or migration generated automatically from production telemetry.
3. Obtain approval for the named production migration before executing production
   DDL. The application deploy workflow is deliberately unable to apply it.
4. Apply only the approved artifact through the approved migration interface.
   Validate the observed column inventory against the artifact's expected result;
   update the release manifest in the application PR with migration evidence.
5. Run canonical verification, review, staging journeys and the check-only gate.
   Merge and deploy the exact reviewed application commit. Automatic post-deploy
   checks cover public web/Bio availability, API/database health and a bounded
   real public catalog read.

## Failed release and rollback

- Schema check fails: inspect bounded findings and compare the reviewed source
  artifact with read-only schema metadata. Keep the currently deployed app live;
  do not retry with schema push, force a hash, or run production teardown.
- Application fails after deployment: redeploy the prior compatible application
  commit through a reviewed rollback PR. Keep additive schema changes in place
  while assessing them; undoing data/schema is a separate approved operation.
- Worker rollback does not reverse PostgreSQL, R2, queues, workflows or Durable
  Object state. Check each affected resource and in-flight work separately.
- Failed health checks flag the deployment; they do not automatically roll back
  stateful resources or initiate money/data repair.
