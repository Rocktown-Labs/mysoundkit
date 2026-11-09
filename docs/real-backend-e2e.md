# Real backend browser journeys

The real suite targets **synthetic staging only**. It is separate from production
release deployment; production URL fallbacks and production fixture credentials
are no longer used. Never enable a mutation suite against production.

## Workflow

`Real Backend Staging Journeys` runs manually and nightly on one serialized
staging lane. It checks the actual database identity marker before launching
Chromium, then repeats that preflight in the suite. The workflow binds staging
runtime credentials and reserved synthetic accounts, with no payment, email or
fulfillment provider keys. It never pushes schema or deploys infrastructure.

The always-on journey uses the real web login forms and API. It checks the
artist identity and private media access, the Bio profile/shared session, logout,
and fan account switching with private/paid-media denial and free WAV playback.
Sessions are signed out in cleanup. It does not upload media, create purchases,
or prove native playback/PiP.

The separate legacy commerce/content journey is **explicitly skipped** until
SoundKit sandbox setup (#528) is verified. A skipped provider case is not payment
sign-off. Strict commerce runs require test credentials/mode and must fail if
seller setup prevents track creation; they cannot return green early. Before
activating that journey in CI, complete its provider setup and bounded cleanup
for the content/cart records it creates.

## Local invocation against staging

Use `tests/e2e/real-backend.env.example` through a private environment manager.
Supply the approved staging `DATABASE_URL` and the existing synthetic artist/fan
passwords; do not paste secrets into logs or commit filled-in environment files.

```sh
bun run test:e2e:real
```

The guard requires exact staging API/web URLs, staging database/media labels,
disabled external effects and the seeded `@example.test` identities. Missing
configuration, production/arbitrary hosts and non-test Stripe keys are rejected
before any browser requests. There is no generic production or local override.

The ordinary fast browser suite remains mocked and does not require these keys.
Preview deploys separately run their real cookie/media checks against each PR's
isolated domains. Schema provisioning follows [staging bootstrap](staging-environment.md)
and [database release policy](database-releases.md), not ad-hoc schema push.
