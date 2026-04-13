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
- `GET /api/v1/me`
- `GET /api/v1/discover/home`
- `GET /api/v1/artists`
- `GET /api/v1/tracks`
- `GET /api/v1/projects`
- `GET /api/v1/videos`
- `GET /api/v1/library/overview`
- `GET /api/v1/playlists`
- `GET /api/v1/messages/conversations`
- `GET /api/v1/analytics/overview`
- `GET /api/v1/billing/plans`
- `GET /api/v1/battles`

## Auth

Better Auth is mounted at:

```text
/api/auth/*
```

Examples:

- `GET /api/auth/get-session`
- Better Auth plugin endpoints for organization/team management

The app also attaches session middleware to all `/api/v1/*` routes.

Right now, many domain endpoints return sample data so the API is testable before PlanetScale, Stripe, R2, and Mux are fully configured.

## API Structure

Base path for domain APIs:

```text
/api/v1
```

### Me

- `GET /api/v1/me`
- `GET /api/v1/me/workspaces`
- `PATCH /api/v1/me/profile`

### Onboarding

- `POST /api/v1/onboarding/artist`
- `POST /api/v1/onboarding/fan`

### Discover

- `GET /api/v1/discover/home`

### Artists

- `GET /api/v1/artists`
- `GET /api/v1/artists/{username}`

### Tracks

- `GET /api/v1/tracks`
- `POST /api/v1/tracks`
- `GET /api/v1/tracks/{trackId}`

### Projects

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/{projectId}`

### Videos

- `GET /api/v1/videos`
- `POST /api/v1/videos`
- `GET /api/v1/videos/{videoId}`

### Library

- `GET /api/v1/library/overview`
- `GET /api/v1/library/recent`
- `GET /api/v1/library/saved`
- `GET /api/v1/library/purchases`

### Playlists

- `GET /api/v1/playlists`
- `POST /api/v1/playlists`
- `GET /api/v1/playlists/{playlistId}`

### Social

- `POST /api/v1/social/posts/{postId}/likes`
- `GET /api/v1/social/posts/{postId}/comments`
- `POST /api/v1/social/posts/{postId}/comments`

### Messages

- `GET /api/v1/messages/conversations`
- `POST /api/v1/messages/conversations`
- `GET /api/v1/messages/conversations/{conversationId}/messages`
- `POST /api/v1/messages/conversations/{conversationId}/messages`

### Analytics

- `GET /api/v1/analytics/overview`

### Billing

- `GET /api/v1/billing/plans`
- `GET /api/v1/billing/subscription`

### Battles

- `GET /api/v1/battles`
- `GET /api/v1/battles/{battleId}`
- `POST /api/v1/battles/challenge`

### Uploads

- `GET /api/v1/uploads`
- `GET|POST /api/v1/uploads/media`

Uploads are wired for Better Upload, but require storage env configuration before they will accept files.

### Webhooks

- `POST /api/v1/webhooks/mux`
- `POST /api/v1/webhooks/stripe`
- `POST /api/v1/webhooks/battle-service`

## Current Status

What is real right now:

- Hono route structure
- OpenAPI generation
- Swagger UI
- Better Auth mount
- Better Auth organization/team support
- Drizzle schema for auth + app domain
- Request/response contracts for core modules

What is still stubbed:

- Most database-backed handlers
- Stripe subscription lifecycle wiring
- R2 upload credentials and object finalization
- Mux direct upload and webhook processing
- Durable Object chat runtime
- Battle service integration with Go/IVS

## Environment Still Needed

To fully activate the backend, you will still need:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- Stripe keys
- Mux keys
- R2/S3-compatible upload env vars

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

1. Connect PlanetScale Postgres and generate migrations.
2. Replace sample responses with Drizzle queries module-by-module.
3. Wire Stripe plans and entitlements.
4. Enable Better Upload against R2.
5. Add Mux direct uploads and webhook handlers.
