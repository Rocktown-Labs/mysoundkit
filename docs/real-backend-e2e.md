# Real Backend E2E

Use this suite after creating one artist account and one fan account in the target environment.

## Required Setup

1. Apply migrations against the target database.

   ```sh
   DATABASE_URL="postgresql://..." bun run db:migrate
   ```

2. Run or deploy the real API and web app.

   The web app must point at the API through `VITE_SERVER_URL`, and the API must allow the web origin through `CORS_ORIGIN`.

3. Finish onboarding for both test users.

   The artist user must have:
   - `accountType: artist`
   - completed onboarding
   - Arkansas or target-state profile data if testing `SOUNDKIT_E2E_SEARCH_STATE=AR`

   The fan user must have:
   - `accountType: fan`
   - completed onboarding

4. Optional for strict checkout validation: complete Stripe Connect setup for the artist and set `SOUNDKIT_E2E_EXPECT_CHECKOUT=true`.

## Environment

Copy `tests/e2e/real-backend.env.example` into your shell or env manager and fill it in:

```sh
export SOUNDKIT_REAL_E2E=true
export PLAYWRIGHT_BASE_URL="https://your-web-url"
export PLAYWRIGHT_API_URL="https://your-api-url"
export SOUNDKIT_E2E_ARTIST_EMAIL="artist@example.com"
export SOUNDKIT_E2E_ARTIST_PASSWORD="..."
export SOUNDKIT_E2E_FAN_EMAIL="fan@example.com"
export SOUNDKIT_E2E_FAN_PASSWORD="..."
export SOUNDKIT_E2E_SEARCH_STATE="AR"
export SOUNDKIT_E2E_EXPECT_CHECKOUT=false
```

## Run

```sh
bun run test:e2e:real
```

The test creates uniquely named public track, open verse, EP project, and listening party records, then signs in as the fan, searches for the track, adds it to cart, and reaches the checkout boundary.

If `SOUNDKIT_E2E_EXPECT_CHECKOUT=false`, checkout may pass with either a Stripe URL or a seller-setup response. Set it to `true` only when Stripe test-mode checkout is expected to be fully live.
