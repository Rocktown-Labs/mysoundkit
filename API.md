# SoundKit API

This document describes the current Hono API foundation in `apps/server`.

## OpenAPI Docs

When the server is running, these endpoints are available:

- Swagger UI: `/api/docs`
- OpenAPI JSON: `/api/openapi.json`
- Health check: `/health`

If you run the server locally on port `3000`, use:

- `http://localhost:3000/api/docs`
- `http://localhost:3000/api/openapi.json`
- `http://localhost:3000/health`

## Running Locally

The API app lives in `apps/server`.

Build it:

```bash
bun run build
```

Typecheck it:

```bash
bun run check-types
```

If you want a local dev server, the simplest current option is to run it through your existing Cloudflare/Alchemy workflow or add a dedicated server dev command next.

Use these commands from the repo root:

```bash
bun run dev
```

That starts:

- website on `http://localhost:3001`
- api on `http://localhost:3000`

## Postman

There are two easy ways to use Postman.

### Option 1: Import OpenAPI

1. Start the API.
2. In Postman, click `Import`.
3. Choose `Link`.
4. Paste `http://localhost:3000/api/openapi.json`.
5. Import the collection.

That will generate requests directly from the OpenAPI spec.

### Option 2: Manual Collection

Use base URL:

```text
http://localhost:3000
```

Useful starter requests:

- `GET /health`
- `GET /v1/me`
- `GET /v1/discover/home`
- `GET /v1/artists`
- `GET /v1/tracks`
- `GET /v1/projects`
- `GET /v1/videos`
- `GET /v1/library/overview`
- `GET /v1/playlists`
- `GET /v1/messages/conversations`
- `GET /v1/analytics/overview`
- `GET /v1/billing/plans`
- `GET /v1/battles`

## Auth

Better Auth is mounted at:

```text
/auth/*
```

Examples:

- `GET /auth/get-session`
- Better Auth plugin endpoints for organization, team, and admin management

The app also attaches session middleware to all `/v1/*` routes.

Core artist, fan, catalog, search, upload, library, collaboration, cart, and payment routes use the configured PostgreSQL database and service bindings. Some discovery and live-battle surfaces still use sample or read-model data while realtime battle implementation is pending.

## API Structure

Base path for domain APIs:

```text
/v1
```

### Me

- `GET /v1/me`
- `GET /v1/me/workspaces`
- `PATCH /v1/me/profile`

### Onboarding

- `POST /v1/onboarding/artist`
- `POST /v1/onboarding/fan`

### Discover

- `GET /v1/discover/home`

### Artists

- `GET /v1/artists`
- `GET /v1/artists/{username}`

### Tracks

- `GET /v1/tracks`
- `POST /v1/tracks`
- `GET /v1/tracks/{trackId}`

### Projects

- `GET /v1/projects`
- `POST /v1/projects`
- `GET /v1/projects/{projectId}`

### Videos

- `GET /v1/videos`
- `POST /v1/videos`
- `GET /v1/videos/{videoId}`

### Library

- `GET /v1/library/overview`
- `GET /v1/library/recent`
- `GET /v1/library/saved`
- `GET /v1/library/purchases`

### Playlists

- `GET /v1/playlists`
- `POST /v1/playlists`
- `GET /v1/playlists/{playlistId}`

### Social

- `POST /v1/social/posts/{postId}/likes`
- `GET /v1/social/posts/{postId}/comments`
- `POST /v1/social/posts/{postId}/comments`

### Messages

- `GET /v1/messages/conversations`
- `POST /v1/messages/conversations`
- `GET /v1/messages/conversations/{conversationId}/messages`
- `POST /v1/messages/conversations/{conversationId}/messages`

### Analytics

- `GET /v1/analytics/overview`

### Billing

- `GET /v1/billing/plans`
- `GET /v1/billing/subscription`

### Administration

- `GET /v1/admin/access`
- `GET /v1/admin/overview`
- `GET /v1/admin/finance/summary`
- Better Auth admin endpoints under `/auth/admin/*` provide user search, roles, bans, session revocation, and impersonation.

Set `ADMIN_EMAILS` to a comma-separated email allowlist. Allowlisted accounts receive the Better Auth `admin` role when created and are reconciled when they access the API.

### Battles

- `GET /v1/battles`
- `GET /v1/battles/{battleId}`
- `POST /v1/battles/challenge`

### Uploads

- `GET /v1/uploads`
- `GET|POST /v1/uploads/media`

Uploads are wired for Better Upload, but require storage env configuration before they will accept files.

### Webhooks

- `POST /v1/webhooks/mux`
- `POST /v1/webhooks/stripe-commerce`
- `POST /v1/webhooks/battle-service`

## Current Status

What is real right now:

- Hono route structure
- OpenAPI generation
- Swagger UI
- Better Auth mount
- Better Auth organization, team, and admin support
- Drizzle schema for auth + app domain
- Request/response contracts for core modules
- PostgreSQL-backed artist/fan onboarding, catalog, search, uploads, library, open verses, listening parties, cart, and payment records
- R2 media upload and Mux direct-video integration when their production bindings are configured

What is still stubbed:

- Live battle orchestration and voting runtime
- Some discovery and live-room sample/read-model surfaces
- Paid subscription checkout until real Stripe Price IDs are configured

## Environment Still Needed

To fully activate the backend, you will still need:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `ADMIN_EMAILS`
- Stripe keys
- Mux keys
- R2/S3-compatible upload env vars: Alchemy deploys bind `UPLOAD_BUCKET_NAME`, generated `CLOUDFLARE_ACCESS_KEY_ID`, and generated `CLOUDFLARE_SECRET_ACCESS_KEY`; `CLOUDFLARE_ACCOUNT_ID` can be discovered from the Alchemy Cloudflare profile, and `CLOUDFLARE_R2_JURISDICTION` is optional

## Deployment Checklist

The production deploy targets are:

- `soundkit-web`
- `soundkit-server`

Before deploying, copy and fill these templates:

- `apps/website/.env.example` -> `apps/website/.env`
- `apps/server/.env.example` -> `apps/server/.env`
- `packages/infra/.env.example` -> `packages/infra/.env`

Minimum required values:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `DATABASE_URL`
- `VITE_SERVER_URL`
- `GOOGLE_GENERATIVE_AI_API_KEY`

Recommended production values:

- `BETTER_AUTH_URL=https://soundkit-server.<your-account>.workers.dev`
- `CORS_ORIGIN=https://soundkit-web.<your-account>.workers.dev`
- `VITE_SERVER_URL=https://soundkit-server.<your-account>.workers.dev`

Deploy from the repo root:

```bash
bun run deploy:prod
```

If the deploy fails, the most likely causes are missing env values in `packages/infra/.env`, missing database setup, or Cloudflare account/resource conflicts.

## Suggested Next Steps

1. Apply the generated Drizzle migration to the production PostgreSQL database.
2. Configure real Stripe products and Price IDs for paid plans.
3. Run the real-backend artist/fan flow in `docs/real-backend-e2e.md`.
4. Replace remaining discovery/live sample read models.
5. Build live battle orchestration and voting.
