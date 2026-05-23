# soundkit

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Hono, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **workers** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **Starlight** - Documentation site with Astro
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Copy `apps/server/.env.example` to `apps/server/.env` and update it with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Use the Expo Go app to run the mobile application.
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and the website app config

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@soundkit/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/website`.

## Deployment (Cloudflare via Alchemy)

This repo deploys the website and API through `packages/infra/alchemy.run.ts` instead of Wrangler auto-config.
Wrangler's scaffold flow uses `npm` internally, which breaks in this Bun workspace because dependencies use the `catalog:` protocol.

- Production worker names are `soundkit-web` and `soundkit-server`.
- The web worker has Cloudflare observability enabled for logs and traces.

### Deployment Checklist

Before deploying, copy and fill these files:

- `apps/website/.env.example` -> `apps/website/.env`
- `apps/server/.env.example` -> `apps/server/.env`
- `packages/infra/.env.example` -> `packages/infra/.env`

Required for a successful deploy:

- `ALCHEMY_PASSWORD`
- `ALCHEMY_STATE_TOKEN` for shared state in CI and coordinated production deploys
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `BETTER_AUTH_SECRET`
- `DATABASE_URL`
- `GOOGLE_EMBEDDING_MODEL`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `STEMSPLIT_API_KEY`
- `STEMSPLIT_WEBHOOK_SECRET`

Recommended production values:

- `BETTER_AUTH_URL=https://soundkit-server.<your-account>.workers.dev`
- `CORS_ORIGIN=https://soundkit-web.<your-account>.workers.dev`
- `VITE_SERVER_URL=https://soundkit-server.<your-account>.workers.dev`

Use these commands from the repo root:

- `bun run dev`: Run the website and server app dev servers through Turbo
- `bun run dev:infra`: Run the Alchemy Cloudflare dev stack for website and server
- `bun run deploy`: Deploy the `prod` web and server workers
- `bun run deploy:prod`: Same production deploy target, explicit name
- `bun run destroy`: Destroy the `prod` Cloudflare resources managed by Alchemy

For more details, see the guide on [Deploying to Cloudflare with Alchemy](https://www.better-t-stack.dev/docs/guides/cloudflare-alchemy).

### GitHub Actions

`.github/workflows/deploy.yml` runs type checks, Worker/unit tests, the production build, and Playwright browser smoke tests before any deployment.

- Pull requests to `master` from this repository deploy an isolated `pr-<number>` preview after checks pass and destroy it when the PR closes.
- Pushes to `master` and manual dispatches deploy the `prod` Alchemy stage after checks pass.
- Pull requests from forks run validation without receiving preview environment secrets or deploying infrastructure.

`bun run check` is intentionally not a required workflow gate until the existing Ultracite backlog is resolved.

Preview web, API, and media origins are stage-aware: a PR such as `#12` uses `https://web-pr-12.mysoundkit.com`, `https://api-pr-12.mysoundkit.com`, and `https://media-pr-12.mysoundkit.com`. The API binds the matching preview web URL as `CORS_ORIGIN`, and Better Auth receives both the preview API URL and trusted preview web origin.

Configure GitHub `production` and `preview` environments. Production protection rules can require approval before deployment. The `preview` environment should use sandbox credentials, including a non-production database and Stripe/Mux/StemSplit keys.

After environment setup is complete, add these repository-level GitHub Actions variables to enable deployment jobs:

- `ENABLE_PREVIEW_DEPLOYS=true`
- `ENABLE_PRODUCTION_DEPLOYS=true`

Until each flag is enabled, its deployment job is skipped while validation continues to run.

Configure these GitHub Actions secrets in each deployment environment:

- `ALCHEMY_PASSWORD`
- `ALCHEMY_STATE_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `BETTER_AUTH_SECRET`
- `DATABASE_URL`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `STEMSPLIT_API_KEY`
- `STEMSPLIT_WEBHOOK_SECRET`

Configure this GitHub Actions variable in each deployment environment:

- `GOOGLE_EMBEDDING_MODEL`

Configure these Stripe price variables when the environment should exercise subscription purchase flows:

- `STRIPE_ARTIST_LITE_MONTHLY_PRICE_ID`
- `STRIPE_ARTIST_LITE_ANNUAL_PRICE_ID`
- `STRIPE_ARTIST_TEAM_MONTHLY_PRICE_ID`
- `STRIPE_ARTIST_TEAM_ANNUAL_PRICE_ID`
- `STRIPE_FAN_LITE_MONTHLY_PRICE_ID`
- `STRIPE_FAN_LITE_ANNUAL_PRICE_ID`
- `STRIPE_FAN_FAMILY_MONTHLY_PRICE_ID`
- `STRIPE_FAN_FAMILY_ANNUAL_PRICE_ID`

Alchemy uses its remote Cloudflare state store whenever `ALCHEMY_STATE_TOKEN` is present, allowing preview cleanup and production updates to run on independent GitHub Actions runners.

## Git Hooks and Formatting

- Format and lint fix: `bun run check`

## Project Structure

```
soundkit/
├── apps/
│   ├── website/     # Frontend application (React + TanStack Start)
│   ├── native/      # Mobile application (React Native, Expo)
│   ├── docs/        # Documentation site (Astro Starlight)
│   └── server/      # Backend API (Hono)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start the website + server app dev servers through Turbo
- `bun run dev:all`: Start all monorepo `dev` tasks through Turbo
- `bun run build`: Build all applications
- `bun run dev:infra`: Start the Alchemy-managed website + server Cloudflare dev stack
- `bun run dev:web`: Start only the website application
- `bun run dev:server`: Start only the server application
- `bun run check-types`: Check TypeScript types across all apps
- `bun run dev:native`: Start the React Native/Expo development server
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI
- `bun run deploy:prod`: Deploy the production web + server workers via Alchemy
- `bun run check`: Run Oxlint and Oxfmt
- `bun run test`: Run unit and Cloudflare Worker API tests
- `bun run test:e2e`: Run Playwright browser smoke tests
- `bun run test:all`: Run unit, Worker, and browser tests
- `cd apps/docs && bun run dev`: Start documentation site
- `cd apps/docs && bun run build`: Build documentation site
