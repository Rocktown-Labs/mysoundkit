# SoundKit

<div align="center">
  <h3>The Next-Generation Creator-First Music Platform, Audio Marketplace & Live Collaborative Arena</h3>
  <p>Engineered for high-throughput streaming, real-time battle arenas, interactive listening parties, open verse collaboration, and direct creator monetization.</p>
</div>

---

## 1. Executive Summary & Core Vision

**SoundKit** is a full-stack, edge-native audio platform and digital marketplace designed from the ground up to empower musicians, beatmakers, producers, vocalists, and fans.

Unlike legacy streaming silos and fragmented beat stores, SoundKit provides an integrated ecosystem featuring:

- **Direct Creator Monetization & Royalties:** 30-Second Verified Play telemetry, qualified monetization curves, transparent settlement reserves, and embedded Stripe Connect payouts.
- **Interactive Live Arenas:** Cloudflare Durable Object-backed live rooms for real-time producer beat battles with spectator queues, fan voting, and synchronized listening parties.
- **Open Verse & Collaboration Hub:** In-browser audio slicing with MediaBunny, 3-part stem/take submissions, and anti-leech upload validation.
- **Edge-Native Performance:** Cloudflare Workers API, Hyperdrive PostgreSQL pooling, client-side WebCodecs audio rendering, and instant TanStack Router navigation.

---

## 2. System Architecture & Tech Stack

```
                                  ┌─────────────────────────────────────────┐
                                  │           SoundKit Clients              │
                                  │  • Web (React 19 + TanStack Router)     │
                                  │  • Mobile (Expo SDK 52 + React Native)  │
                                  └────────────────────┬────────────────────┘
                                                       │
                                     HTTPS / REST / WSS / WebSockets
                                                       │
                                                       ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               Cloudflare Edge Network (apps/server)                               │
├──────────────────────────────────────────────────────┬────────────────────────────────────────────┤
│  OpenAPI Hono REST Endpoints (/v1/*)                 │  Realtime Durable Objects (workerd)        │
│  • Swagger UI & OpenAPI Specification                │  • LiveRoomDurableObject (Battles/Parties) │
│  • Better Auth + Turnstile Validation                │  • PresenceDurableObject (Live Presence)   │
├──────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│  Asynchronous Workflows & Queues                     │  Scheduled Cron Event Engine               │
│  • TrackProcessingWorkflow (Transcoding/Stems)       │  • runBattleServiceSweep                   │
│  • LiveRecordingWorkflow (Replay Publishing)         │  • publishDueLiveRecordings                │
│  • LIVE_NOTIFICATION_QUEUE (Fanout Alerts)           │  • sendDueOnboardingReminders              │
│  • EMAIL_DELIVERY_QUEUE (Transactional Resend)       │  • publishDueTrackReleases                 │
└──────────────────────────┬───────────────────────────┴────────────────────────────────────────────┘
                           │
             Cloudflare Hyperdrive / TCP
                           │
                           ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Data, Media & External Services                                   │
├──────────────────────────────────────┬──────────────────────────────────┬─────────────────────────┤
│  PostgreSQL + pgvector (Drizzle ORM) │  Cloudflare R2 Object Storage    │  Stripe Connect         │
│  • Catalog, Artists, Battles, Takes  │  • Master Audio, Stems, Covers   │  • Creator Payout Rails │
│  • Semantic Vector Embeddings        │  • Open Verse Audio Clips        │  • Plan Subscriptions   │
└──────────────────────────────────────┴──────────────────────────────────┴─────────────────────────┘
```

### Core Technologies

| Layer                  | Technologies                                                                                                                                                                                                                                     |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Monorepo Engine**    | [Turborepo](https://turbo.build/), [pnpm](https://pnpm.io/) (v11 Catalog Mode), [Bun](https://bun.sh/) (Runtime & Test Runner)                                                                                                                   |
| **Web Frontend**       | [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TanStack Router](https://tanstack.com/router), [TanStack Query v5](https://tanstack.com/query), [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/) |
| **Audio Processing**   | [MediaBunny](https://github.com/mediabunny) (Client-Side WASM/WebCodecs Audio Slicer & Waveform Generator), HTML5 Web Audio API                                                                                                                  |
| **Mobile App**         | [Expo SDK 52](https://expo.dev/), [React Native 0.83](https://reactnative.dev/), [Expo Router v4](https://docs.expo.dev/router/introduction/), React Native Reanimated v4                                                                        |
| **API Backend**        | [Cloudflare Workers](https://workers.cloudflare.com/) (`nodejs_compat`), [Hono OpenAPI](https://hono.dev/), [Stoker](https://github.com/), [Sentry Observability](https://sentry.io/)                                                            |
| **Stateful Edge**      | Cloudflare [Durable Objects](https://developers.cloudflare.com/durable-objects/) (Live Room state machines & Presence tracking), [Workflows](https://developers.cloudflare.com/workflows/), [Queues](https://developers.cloudflare.com/queues/)  |
| **Database & ORM**     | [PostgreSQL](https://www.postgresql.org/) with `pgvector`, [Drizzle ORM](https://orm.drizzle.team/), [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) connection pooling                                                   |
| **Auth & Security**    | [Better Auth](https://www.better-auth.com/), [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) CAPTCHA, Type-safe Session Middleware                                                                                        |
| **Payments & Billing** | [Stripe Connect](https://stripe.com/connect) (Express Onboarding, Direct & Destination Charges), Stripe Billing & Invoicing                                                                                                                      |
| **Media & Delivery**   | [Cloudflare R2](https://developers.cloudflare.com/r2/) Object Storage, [Mux Video](https://mux.com/), [Resend](https://resend.com/) + [React Email](https://react.email/)                                                                        |
| **Code Standards**     | [Ultracite](https://github.com/) (Zero-config Oxlint + Oxfmt linter/formatter preset)                                                                                                                                                            |

---

## 3. Monorepo Structure

```
mysoundkit/
├── apps/
│   ├── docs/                 # Astro 6 + Starlight documentation portal
│   ├── native/               # Expo SDK 52 / React Native mobile companion app
│   ├── server/               # Cloudflare Workers OpenAPI REST API & Durable Objects
│   └── website/              # TanStack Router React 19 web application & Media Studio
├── packages/
│   ├── auth/                 # Better Auth server/client bindings, Turnstile validation
│   ├── config/               # Shared TypeScript base configurations
│   ├── db/                   # Drizzle ORM schemas, pgvector queries, and 36+ migrations
│   ├── env/                  # Zod-validated environment configurations (client/server)
│   ├── infra/                # Alchemy Cloudflare deployment orchestration scripts
│   ├── transactional/        # React Email component templates and Resend mailer
│   └── ui/                   # Shared design system components & Radix UI primitives
├── scripts/                  # Code quality verification, migration, and automation tools
├── .agents/                  # Skill manifests and dynamic agent instruction protocols
├── AGENTS.md                 # Plan-to-ship workflow, GitHub CLI rules & verification gates
└── API.md                    # Detailed OpenAPI route listings and Postman import guide
```

---

## 4. Deep Dive: Applications

### `apps/server` (Cloudflare Workers API)

The backend server is an edge API built with Hono and `@hono/zod-openapi`, deployed as a Cloudflare Worker using the `nodejs_compat` compatibility flag.

- **Interactive API Documentation:**
  - Swagger UI: `GET /api/docs`
  - OpenAPI Specification: `GET /api/openapi.json`
  - Health Verification: `GET /health` (validates Cloudflare runtime and Hyperdrive PostgreSQL connectivity)
- **Durable Objects:**
  - `LiveRoomDurableObject`: Manages stateful producer beat battles, spectator admission queues (`BATTLE_ADMISSION_BATCH_SIZE`), live round countdown timers, real-time fan voting calculations, and synchronized listening party playback.
  - `PresenceDurableObject`: Tracks authenticated user presence across workspaces, channels, and active sessions with delta WebSocket broadcasting and coalesced database persistence.
- **Cloudflare Workflows & Queues:**
  - `TrackProcessingWorkflow`: Handles asynchronous audio asset transcoding, normalization, and waveform peak extraction.
  - `LiveRecordingWorkflow`: Archives audio streams from live battles and listening parties, packaging replays and post-event release stubs.
  - `LIVE_NOTIFICATION_QUEUE`: Asynchronously fans out live event announcements to fan followers.
  - `EMAIL_DELIVERY_QUEUE`: Queues transactional emails with exponential backoff retry policies.
- **Automated Cron Jobs (`scheduled` triggers):**
  - Sweeps active battle states and concludes expired rounds.
  - Auto-publishes due live recording replays and scheduled track releases.
  - Retries queued email deliveries and dispatches creator onboarding reminders.

### `apps/website` (Creator Studio & Fan Experience)

A React 19 application powered by Vite and TanStack Router with client-side audio rendering and real-time state synchronization.

- **Audio Engine & MediaBunny Studio:**
  - Utilizes `@mediabunny/aac-encoder` and WebCodecs for client-side waveform analysis and audio extraction.
  - Generates lightweight Hook & Open Verse snippets (`.wav`) in the browser during track upload, uploading preview stubs directly to R2 and protecting unreleased master audio from server-side leaks.
  - Features `VisualWaveformSlotTrimmer` with amplitude waveform visualization, zoom controls, draggable hook start & open slot trim markers, and audition playback.
- **Global Music Player:**
  - Persistent floating audio player context with queue management, track scrubbing, and auto-play download unlocking.
  - Enforces the **30-Second Verified Play Rule** (listening sessions ≥ 30s or ≥ 95% completion for short tracks) to compute genuine stream metrics without synthetic inflation.
- **Creator Dashboard & Earnings Dashboard:**
  - Full telemetry analytics (`/dashboard/career/analytics`): Timeseries graphs (Plays, Qualified Streams, Unique Listeners) across 7D, 28D, 90D, and 12M windows; Track Performance tables; Audience Loyalty & Retention; Privacy-safe Geographic Distribution (`MIN_LOCATION_LISTENERS = 3`).
  - Creator Payments Dashboard (`/dashboard/career/payments`): Month-to-date estimated earnings, 30-day settlement reserve tracker, $25 minimum payout progress bar, monthly statement history, and embedded Stripe Connect payout rails.
- **Open Verses & Battle Arena:**
  - 3-part take uploader: Mixed Audition Take, Raw Dry Vocal Take, and Stems/Project Archive.
  - Anti-Leech Guard (0-Uploads Rule): Prevents blank accounts from submitting takes until they have published a track or project.
  - Live Arena: Scheduled-phase waiting rooms, audio-visual stage countdowns, batch fan admission between rounds, and live voting.

### `apps/native` (Expo / React Native Companion App)

A native mobile client built with Expo SDK 52 and Expo Router v4 for iOS and Android.

- Native bottom tab navigation (`Home`, `Music`, `Create`, `Career`, `Live`).
- Secure token persistence using `expo-secure-store`.
- Better Auth client integration via `@better-auth/expo`.
- AI-assisted lyric generation and companion chat with `@ai-sdk/react`.

### `apps/docs` (Documentation Portal)

A static documentation engine built with Astro 6 and Starlight, offering Pagefind client-side search, API documentation, and creator guides.

---

## 5. Deep Dive: Shared Packages

- **`@soundkit/db`**:
  - Drizzle ORM schema mapping PostgreSQL tables, relations, indexes, and pgvector extension hooks.
  - Key schemas: `authUser`, `authSession`, `organization`, `tracks`, `projects`, `audioAssets`, `openVerseTakes`, `battles`, `battleQueueEntries`, `listeningParties`, `playbackSessions`, `userNotifications`, `stripeAccounts`, and `emailDeliveries`.
  - Migration tooling and custom seed scripts (`pnpm db:generate`, `pnpm db:push`, `pnpm db:seed`).
- **`@soundkit/auth`**:
  - Better Auth server instance and client adapters with plugins for organizations, multi-tenancy, and admin access control.
  - Cloudflare Turnstile CAPTCHA verification hook protecting authentication endpoints and take submissions.
- **`@soundkit/env`**:
  - Runtime validation using Zod for client-safe public variables and server-only secrets.
- **`@soundkit/transactional`**:
  - React Email component templates: Welcome Sequences, Live Party Invites, Battle Notifications, Purchase Receipts, and Payout Summaries.
- **`@soundkit/ui`**:
  - Shared Radix UI component library styled with Tailwind CSS v4, supporting dark mode tokens, modals, popovers, dropdowns, and accessible forms.

---

## 6. Local Development Guide

### Prerequisites

- **Node.js**: `v22.0.0` or higher
- **pnpm**: `v11.9.0` or higher (`corepack enable pnpm`)
- **Bun**: `v1.2.0` or higher (used for execution and test runner)
- **PostgreSQL**: Local PostgreSQL instance with `pgvector` extension enabled, or a remote PostgreSQL database URL (e.g. Neon, Supabase, Cloudflare Hyperdrive)

### Installation & Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Rocktown-Labs/mysoundkit.git
   cd mysoundkit
   ```

2. **Install monorepo dependencies:**

   ```bash
   pnpm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment files and provide your secrets:

   ```bash
   cp apps/server/.env.example apps/server/.env
   cp apps/website/.env.example apps/website/.env
   ```

   _Key environment variables required:_
   - `DATABASE_URL`: PostgreSQL connection string (direct or pooled)
   - `BETTER_AUTH_SECRET`: Secret key for Better Auth session signing
   - `BETTER_AUTH_URL`: Base URL for Better Auth (e.g. `http://localhost:3000`)
   - `CORS_ORIGIN`: Allowed frontend origin (e.g. `http://localhost:3001`)
   - `STRIPE_SECRET_KEY`: Stripe API secret key for billing & Connect
   - `STRIPE_BETTER_AUTH_WEBHOOK_SECRET`: Better Auth Stripe webhook signature secret
   - `STRIPE_COMMERCE_WEBHOOK_SECRET`: Stripe commerce webhook signature secret
   - `STRIPE_CONNECT_WEBHOOK_SECRET`: Stripe Connect webhook signature secret
   - `RESEND_API_KEY`: Resend API key for transactional emails
   - `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile secret key

4. **Initialize the Database:**

   ```bash
   # Push schema directly to the database
   pnpm db:push

   # Or run migrations
   pnpm db:migrate

   # Seed development database with initial catalog and demo artists
   pnpm db:seed
   ```

5. **Start Local Development:**
   ```bash
   bun run dev
   ```
   _This starts the services concurrently:_
   - **Website:** `http://localhost:3001`
   - **API Server:** `http://localhost:3000`
   - **Swagger Docs:** `http://localhost:3000/api/docs`

---

## 7. Useful Monorepo Commands

| Command                     | Description                                                                                                          |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`               | Starts website and API server in development mode                                                                    |
| `bun run build`             | Builds all packages and applications for production                                                                  |
| `bun run verify`            | **Canonical Quality Gate**: Runs type checks, React hook validations, unit tests, worker tests, and production build |
| `bun run verify:pr`         | Runs full verification pipeline plus Playwright E2E browser tests                                                    |
| `bun run test:unit`         | Executes all Vitest unit tests                                                                                       |
| `bun run test:worker`       | Executes Cloudflare Worker and Durable Object integration tests with Miniflare/workerd                               |
| `bun run check-types`       | Runs TypeScript compiler checks across all workspaces                                                                |
| `bun run check:react-hooks` | Validates React hook dependency and import rules                                                                     |
| `bun run fix`               | Automatically formats and fixes linter issues via Ultracite (Oxlint/Oxfmt)                                           |
| `pnpm db:generate`          | Generates new Drizzle SQL migration files from schema                                                                |
| `pnpm db:push`              | Pushes Drizzle schema definitions directly to PostgreSQL                                                             |
| `pnpm db:studio`            | Launches Drizzle Studio GUI for visual database management                                                           |
| `pnpm db:seed`              | Seeds database with demo artists, tracks, open verses, and battles                                                   |

---

## 8. Quality Gates, CI/CD & Agent Guidelines

### Canonical Quality Gate

Before committing code or opening a Pull Request, you must ensure the verification suite passes cleanly:

```bash
bun run verify
```

To auto-format and fix linting issues according to **Ultracite** standards:

```bash
bun run fix
```

### GitHub-Driven Plan-to-Ship Lifecycle

All contributors and autonomous agents must follow the plan-to-ship protocol defined in [`AGENTS.md`](file:///home/ubuntu/work/projects/mysoundkit/AGENTS.md):

1. **GitHub Issue:** Changes must trace back to a GitHub Issue.
2. **Branch Naming:** Create a feature/chore/fix branch from latest `master` (`<type>/<slug>-<issueNumber>`).
3. **Verify:** Run `bun run verify` and ensure all tests, type checks, and builds succeed.
4. **Pull Request:** Open a PR matching the issue title with `gh pr create`. Include detailed summaries and `CHANGELOG.md` updates.
5. **No Direct Pushes:** Never push directly to `master`. All deployments are managed through Pull Request preview builds.

---

## 9. Security & Disclosure

This repository is **private and closed-source**. All API credentials, webhook secrets, encryption keys, and customer data must remain strictly confidential and protected by environment isolation.

---

<div align="center">
  <sub>Built with ❤️ by Rocktown Labs.</sub>
</div>
