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

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `DATABASE_URL`
- `VITE_SERVER_URL`
- `GOOGLE_GENERATIVE_AI_API_KEY`

Optional for later features:

- `UPLOAD_BUCKET_NAME`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`

Recommended production values:

- `BETTER_AUTH_URL=https://soundkit-server.<your-account>.workers.dev`
- `CORS_ORIGIN=https://soundkit-web.<your-account>.workers.dev`
- `VITE_SERVER_URL=https://soundkit-server.<your-account>.workers.dev`

Use these commands from the repo root:

- `bun run dev`: Run the website and server app dev servers through Turbo
- `bun run dev:infra`: Run the Alchemy Cloudflare dev stack for website and server
- `bun run deploy`: Deploy the production web and server workers
- `bun run deploy:prod`: Same production deploy target, explicit name
- `bun run destroy`: Destroy deployed Cloudflare resources managed by Alchemy

For more details, see the guide on [Deploying to Cloudflare with Alchemy](https://www.better-t-stack.dev/docs/guides/cloudflare-alchemy).

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
- `cd apps/docs && bun run dev`: Start documentation site
- `cd apps/docs && bun run build`: Build documentation site
