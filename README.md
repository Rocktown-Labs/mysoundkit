# soundkit

A monorepo built with a modern TypeScript stack (Better-T-Stack). Apps: web (Vite + React), native (Expo), server (Hono), docs (Astro). Shared code lives under `packages/*` (ui, auth, db, infra, etc.).

Quick analysis

- Monorepo managed by Turborepo (turbo). Package manager: Bun.
- Web app builds with Vite; CI runs `turbo build` then Playwright smoke tests.
- Tests: Vitest for unit/worker tests, Playwright for e2e browser checks.
- Common CI failure mode: duplicate identifier declarations in components (e.g. a local `Label` function shadowed an imported `Label`). That was fixed in `apps/website/src/components/dashboard/videos/add-video-dialog.tsx` (removed local `Label`).

Quickstart

1. Install dependencies:

```bash
bun install
```

2. Local development (runs web + server via turbo):

```bash
bun run dev
```

3. Build everything:

```bash
bun run build
```

4. Run tests:

```bash
bun run test       # unit + worker
bun run test:e2e   # Playwright browser tests
```

Environment & DB

- Copy and populate env files before running services (see `apps/website/.env.example`, `apps/server/.env.example`, `packages/infra/.env.example`).
- DB: PostgreSQL + Drizzle. Apply schema with `bun run db:push`.

CI / Deploy notes

- CI pipeline (.github/workflows/deploy.yml) runs type checks, tests, the build, and Playwright smoke tests before deploying.
- Playwright failures often indicate regressions in the UI build; to reproduce locally run `bun run build` and `bun run test:e2e`.
- If a build fails with a Rollup "Identifier has already been declared" error, inspect the component file for duplicate named exports or local functions that shadow imported component names (example: `Label`). Renaming or removing the local declaration resolves the issue.

Contributing

- Use `bun run fix` (Ultracite) to auto-fix formatting/lint issues before committing.
- Run `bun run check` to lint/format locally.
- Open PRs against `master` for preview deployments; CI will run validations and create preview environments.

Recent fixes

- Removed a duplicate `Label` function in `apps/website/src/components/dashboard/videos/add-video-dialog.tsx` to fix a production build failure during CI that blocked deployments.

Contact

- For infra or deploy issues, check `packages/infra` and the GitHub Actions logs for Playwright failures.

---

(Original README content retained in repo history; this file was updated to add a concise quickstart, analysis notes, and recent-fix guidance.)
