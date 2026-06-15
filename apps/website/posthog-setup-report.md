<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into this TanStack Start application. The integration includes client-side SDK initialization with a reverse proxy, user identification on login and signup, 10 custom event captures across 8 files, a server-side PostHog client singleton, and a pre-built analytics dashboard with 5 insights.

**Files created or modified:**

| File                                            | Change                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/app/__root.tsx`                            | Added `PostHogProvider` wrapping the app body with env-var config and `/ingest` proxy   |
| `vite.config.ts`                                | Added `/ingest`, `/ingest/static`, `/ingest/array` reverse proxy entries                |
| `src/lib/posthog-server.ts`                     | New file — singleton `posthog-node` client for server-side event capture                |
| `src/app/login.tsx`                             | `user_signed_in` capture + `posthog.identify()` + error tracking                        |
| `src/app/signup/fan/credentials.tsx`            | `user_signed_up` (fan) capture + `posthog.identify()` + error tracking                  |
| `src/app/signup/artist/credentials.tsx`         | `user_signed_up` (artist) capture + `posthog.identify()` + error tracking               |
| `src/app/signup/fan/onboarding.tsx`             | `fan_onboarding_completed` capture with plan and genre data + error tracking            |
| `src/app/signup/artist/onboarding.tsx`          | `artist_onboarding_completed` capture with plan, roles, and genre data + error tracking |
| `src/components/dashboard/new-track-form.tsx`   | `track_uploaded` capture with track metadata + upload error tracking                    |
| `src/components/dashboard/new-project-form.tsx` | `project_created` capture with project type and collaborator counts + error tracking    |
| `src/components/cart-provider.tsx`              | `cart_item_added`, `cart_item_removed`, `cart_cleared` captures                         |
| `package.json`                                  | Added `@posthog/react` and `posthog-node` dependencies                                  |
| `.env`                                          | Added `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST`                |

**Events instrumented:**

| Event                         | Description                                                  | File                                            |
| ----------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `user_signed_in`              | User successfully signed in with email and password          | `src/app/login.tsx`                             |
| `user_signed_up`              | New fan account created via email signup                     | `src/app/signup/fan/credentials.tsx`            |
| `user_signed_up`              | New artist account created via email signup                  | `src/app/signup/artist/credentials.tsx`         |
| `fan_onboarding_completed`    | Fan completed onboarding and selected a subscription plan    | `src/app/signup/fan/onboarding.tsx`             |
| `artist_onboarding_completed` | Artist completed onboarding and selected a subscription plan | `src/app/signup/artist/onboarding.tsx`          |
| `track_uploaded`              | Artist successfully uploaded a new track master file         | `src/components/dashboard/new-track-form.tsx`   |
| `project_created`             | Artist created a new music project (album, EP, or single)    | `src/components/dashboard/new-project-form.tsx` |
| `cart_item_added`             | User added a track or beat license to their cart             | `src/components/cart-provider.tsx`              |
| `cart_item_removed`           | User removed an item from their cart                         | `src/components/cart-provider.tsx`              |
| `cart_cleared`                | User cleared all items from their cart                       | `src/components/cart-provider.tsx`              |

## Next steps

Run `bun install` from the monorepo root to install the `@posthog/react` and `posthog-node` packages added to `package.json`.

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1625065)
- [Signup to Onboarding Funnel](/insights/OTaqTEyD) — conversion rate from account creation to onboarding completion
- [New Signups Over Time](/insights/tq5QjAh0) — daily fan and artist registrations
- [Onboarding Completions](/insights/PrgLg83O) — fan vs artist onboarding completions
- [Track Uploads Over Time](/insights/pda1XyEq) — artist engagement via track uploads
- [Cart Add-to-Cart vs Removals](/insights/1qH2trUW) — purchase intent and cart friction signals

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
