# Printful Print-on-Demand Merch Engine — Architecture & Implementation Plan

**Issue:** [#406 — Print-on-Demand Merch Engine - Printful API v2 Integration (Apparel & Merch)](https://github.com/Rocktown-Labs/mysoundkit/issues/406)
**Related:** [#405 — Physical Merch (CD/Vinyl/DVD) POD with Kunaki](https://github.com/Rocktown-Labs/mysoundkit/issues/405) (in flight on `feat/physical-merch-kunaki-405`)
**Supersedes/absorbs:** `docs/printful-readiness.md` (the reserved `printful` provider becomes real)
**Plan status:** Approved architecture, ready for milestone implementation. No code written yet.

---

## 0. Confirmed Product Decisions

| Decision | Choice |
| --- | --- |
| Printful account model | **Centralized SoundKit master store** — one private token, one webhook config, all drop-ship orders execute under SoundKit's Printful account (mirrors the Kunaki decision in #405). |
| Launch catalog | **Curated apparel set** — ~3–5 hand-picked blanks (e.g. Bella+Canvas 3001 tee, hoodie, long-sleeve) stored as a curated allowlist snapshot in our DB. |
| V1 design experience | **Artwork upload + placement** — artist uploads a print file (or reuses cover art), picks a placement (front/back), we generate real Printful mockups. No canvas library in v1 (none exists in the repo today); a Fabric.js-class editor is a v2 follow-up. |
| Economics | **Kunaki-aligned: 12% platform fee + COGS recovery.** Fan pays retail + exact shipping pass-through. Stripe `application_fee_amount` = 12% of retail + Printful base cost + shipping. Artist nets `retail − 12% − base`. |
| Shipping scope | **US-only at launch.** Matches the platform's USD-only storefront; worldwide follows later through the same `/v2/shipping-rates` pipeline. |

---

## 1. Current Architecture Findings (Phase 1 Exploration)

### 1.1 Stack snapshot

| Layer | Today |
| --- | --- |
| Frontend | `apps/website` — TanStack Start (React 19, SSR, file-based routes in `src/app/`), Tailwind/shadcn-style `ui/` components, TanStack Router + query hooks in `src/lib/soundkit-api-hooks.ts`. **No canvas library installed** (no Fabric.js/Konva). |
| Backend | `apps/server` — Hono `OpenAPIHono` on **Cloudflare Workers** (`@hono/zod-openapi` + stoker helpers, Zod schemas in `src/lib/schemas.ts`, routes mounted under `/v1/*` in `src/index.ts`). |
| Database | `packages/db` — Drizzle ORM + Postgres (Hyperdrive), migrations in `src/migrations` (master currently ends at **`0063_spooky_chat`**), schema split into `app.ts`, `commerce.ts`, `payments.ts`, `plans.ts`, etc. |
| Infra/secrets | `packages/infra/alchemy.run.ts` (Alchemy v2 IaC) declares every Worker binding; secrets arrive via `Config.Redacted(...)` or `optionalEnvBinding(...)` and are read at runtime through `packages/env` (`env` from `cloudflare:workers`). Deploy-time values come from `apps/server/.env` / root `.env` (dotenv). |
| Commerce today | Stripe Connect **destination charges**: `POST /v1/payments/checkout` creates `transactions` + `orders` (`checkout_pending`) + `orderItems` snapshots, then a Stripe Checkout Session with `payment_intent_data[application_fee_amount]` + `transfer_data[destination]`. Single-seller cart enforced (`lib/checkout-policy.ts`). **No shipping address is collected anywhere today.** |
| Post-payment | `webhooks-stripe.ts` verifies signatures, dedupes via `stripeWebhookEvents`, marks orders `paid`, then launches the durable **`PurchaseFulfillmentWorkflow`** (idempotent steps: grant `purchases`, delivery emails, notifications). `runCheckoutReconciliation()` is the scheduled safety net. |
| Webhook plumbing | Generic `webhooks.ts` handles Mux/Resend/etc. with per-provider HMAC verification (WebCrypto) + a shared `webhookEvents` dedupe/audit table keyed on `(provider, externalEventId)` with `webhookProviderEnum`. |
| Media/files | R2 bucket `soundkit-media`; browser uploads via better-upload multipart with `uploadIntents` (routes `uploads.ts`, lib `upload-intents.ts`, object keys constrained to `profiles|projects|tracks|uploads/`); public URLs via `MEDIA_PUBLIC_URL` (`media.mysoundkit.com/media/<objectKey>`); S3 keypairs already bound server-side for presigning. |
| Entitlements | `lib/entitlements.ts` resolves `canSellProducts` (`can_sell_products` / `products:sell`) — true for paid artist plans. Premium artist plan price IDs already exist in alchemy. |
| Feature flag | `VITE_ENABLE_MERCH` (`featureFlags.merch`) — defined, default `false`. This is our kill-switch for all fan-facing merch UI. |
| Existing Printful groundwork | `fulfillmentProviderEnum` already includes `"printful"` (reserved since migration 0001); `sellableProducts` is a provider-neutral table with `fulfillmentProvider` + `fulfillmentProviderReference`; `docs/printful-readiness.md` prescribes the exact flow and module homes: `packages/db/src/schema/fulfillment.ts`, `apps/server/src/routes/fulfillment-printful.ts`, `apps/server/src/lib/printful.ts`. |

### 1.2 Checkout gap analysis

- `carts`/`cartItems` support `track` + `project` product types with price snapshots; `#405` is adding `physical_merch` (product type + purchase mode), `physicalReleaseId` on cart/order items, and shipping/tracking columns on `orders` — **this plan reuses those shared columns rather than duplicating them.**
- `cart-drawer.tsx` calls `POST /v1/payments/checkout` with an idempotency key; the server builds the Stripe session from cart item snapshots.
- Shipping must be solved end-to-end: address capture, live rates, a shipping line item, and tracking state — none of which exist today.

---

## 2. Printful API v2 Alignment (Phase 2)

All requests go to **`https://api.printful.com/v2/`** (never legacy v1 paths). Auth is `Authorization: Bearer {PRINTFUL_API_KEY}` (Private Token, scopes: `orders`, `file_library`, `webhooks`). If an account-level token is used, every request also carries `X-PF-Store-Id: {PRINTFUL_STORE_ID}`.

### 2.1 Endpoint map (what we use, and why)

| Concern | Printful v2 endpoint | Our usage |
| --- | --- | --- |
| Variant resolution | `GET /v2/catalog-products`, `GET /v2/catalog-products/{id}/catalog-variants`, `GET /v2/catalog-variants/{id}` | Resolve **variant IDs only** (size+color physical blanks) for the curated set; sync into `merch_catalog_*` cache tables. Docs stress: never order against product IDs. |
| Pricing | `GET /v2/catalog-variants/{id}/prices`, `GET /v2/catalog-products/{id}/prices` | Snapshot base cost per variant (drives COGS recovery + retail bounds + payout preview). |
| Placements/techniques | `GET /v2/catalog-products/{id}` (`placements[]`, `techniques[]`) + `GET /v2/catalog-products/{id}/mockup-styles` | Drives the placement picker (front/back/etc.) and mockup style IDs. |
| File registration | `POST /v2/files` (File Library, add by URL) | Register the print file once at design save; store `printfulFileId`. Order items then reference the file by URL (Printful reuses by URL hash) — resilient even if our R2 URL later moves. |
| Async mockups | `POST /v2/mockup-tasks` → `GET /v2/mockup-tasks?id={taskId}` + `mockup_task_finished` webhook | Photorealistic previews per (design × variant × style). Async task pattern with poll + webhook fallback. |
| Live shipping | `POST /v2/shipping-rates` | Real-time carrier quotes: recipient (`state_code`, `country_code`, `zip`) + items (`catalog_variant_id`, `quantity`) + currency → rates with `rate`, `shipping_method_name`, `min/max_delivery_days` + `min/max_delivery_date` (EDD), and `customs_fees_possible` per shipment. |
| Draft orders | `POST /v2/orders` (draft only — v2 **cannot** create confirmed orders directly) | Create with `external_id` = our `orders.id` (idempotency), recipient, shipping method, itemized `order_items[]` each with `external_id` = our `orderItems.id`, `catalog_variant_id`, `quantity`, `retail_price`, `placements[{placement, technique, layers[{type:"file", url, position}]}]`. |
| Cost readiness | order `costs.calculation_status` (async) | Cannot confirm while `calculating`; the fulfillment workflow polls before confirming. Exact final costs (incl. tax) are snapshotted for reconciliation. |
| Confirm | `POST /v2/orders/{id}/confirm` | Called only after our Stripe payment succeeded **and** Printful costs finished calculating. |
| Tracking | `GET /v2/orders/{id}/shipments` | Carrier, service, `tracking_number`, `tracking_url`, `shipped_at`, `delivery_status`, `estimated_delivery`, `tracking_events[]` — backs the fan/artist tracking UI and the webhook safety net. |
| Webhooks | `POST /v2/webhooks/config` (set up), per-event configuration | Subscribe: `shipment_sent`, `shipment_delivered`, `shipment_returned`, `shipment_out_of_stock`, `shipment_canceled`, `order_failed`, `order_canceled`, `order_updated`, `order_put_hold`, `order_refunded`, `catalog_stock_updated`, `catalog_price_changed`, `mockup_task_finished`. |

### 2.2 Rate-limit design (leaky bucket)

Printful v2 uses a leaky/token bucket: **120 requests/min** general (refill ~1 token per 500 ms; headers `X-Ratelimit-Limit/Remaining/Reset/Policy`), **2–10 tasks/min** for Mockup Generator creation, `429` + `Retry-After` on exhaustion. Their docs recommend: respect `Retry-After`, queue at the sustainable rate, separate the resource-intensive endpoint, and cache catalog data.

Our design:

1. **`lib/printful.ts` client** — every call funnels through `printfulRequest()`:
   - Bearer + `X-PF-Store-Id` headers, JSON bodies, RFC 9457 problem-details error parsing.
   - On `429`: read `Retry-After`, retry via the existing `withRetry` (`lib/retry.ts`) with jittered exponential backoff; log endpoint + wait (never drop silently).
   - On `401`: structured `printful_auth_failed` warning — token rotation is an ops runbook item (Private Tokens have expiration dates and cannot be refreshed programmatically).
   - Reads of curated catalog data always hit our **DB cache tables**, never Printful on request paths (only the scheduled sync + webhooks touch catalog endpoints).
2. **Mockup generation gets its own pipeline** — a dedicated Cloudflare Queue (`soundkit-merch-mockup-tasks` + DLQ) whose consumer runs with `maxConcurrency: 1` and a small batch, capped well below the 2–10 tasks/min ceiling. Task rows in `merch_mockups` are the durable backlog; a scheduled sweep polls stale `pending` tasks via `GET /v2/mockup-tasks` as the webhook fallback (docs explicitly recommend poll-as-backup).
3. **Order creation is naturally low-volume** (only after Stripe payment) and idempotent via `external_id`, so bursts are impossible; the fulfillment workflow's polling steps use step-sleep backoff.

### 2.3 Webhook security

Printful v2 enforces HTTPS, adds webhook expiration dates, and **signs every event**: HMAC-SHA256 of the raw request body, hex signature in the **`x-pf-webhook-signature`** header, keyed by the configuration's `secret_key` (returned hex — decode before use). We mirror the existing `webhooks-stripe.ts` / `webhooks.ts` patterns:

- Read the raw body, verify the HMAC with WebCrypto (same `crypto.subtle` pattern as `verifyBattleServiceSignature`), constant-time compare.
- Events with invalid/missing signatures are logged and ignored (per Printful guidance).
- Every accepted event is recorded in the shared `webhookEvents` table (`webhookProviderEnum` gains `"printful"`); Printful v2 events carry no stable event UUID, so `externalEventId` = `{type}:{order.external_id|shipment.id}:{occurred_at}`. Handlers are **set-based and idempotent** so redeliveries (see the event `retries` field) are safe even when the synthetic key differs.

---

## 3. Database Migrations (Deliverable 1)

New file `packages/db/src/schema/fulfillment.ts` (the home `docs/printful-readiness.md` prescribes), plus additive columns that coordinate with #405. **Sequencing rule:** #405 takes migration `0064` (it is mid-flight with `physical_releases`); this plan's schema PR must **rebase on master after #405 merges** and generate the following migration afterward (expected `0065`). Do not generate a parallel `0064` — journal conflicts are guaranteed otherwise.

### 3.1 New enums

```ts
// fulfillment.ts
export const merchStatusEnum = pgEnum("merch_status", [
  "draft",      // created, mockups may not exist yet
  "ready",      // mockups generated + publishable
  "published",  // live in the fan shop
  "archived",
]);

export const mockupTaskStatusEnum = pgEnum("mockup_task_status", [
  "queued",     // row created, task not yet submitted (queue backlog)
  "pending",    // Printful task id received, generating
  "completed",
  "failed",
]);
```

### 3.2 Reused from #405 (do not redefine)

- `productTypeEnum` / `purchaseModeEnum` value **`physical_merch`** — used for Printful apparel items too (one product type for "physical goods", distinguished by content).
- `orders`: `fulfillmentStatus`, `shippingAddress1/2`, `shippingCity`, `shippingCompany`, `shippingCountry`, `shippingDescription`, `shippingName`, `shippingPostalCode`, `shippingStateProvince`, `shippingFeeCents`, `shippedAt`, `trackingNumber`, `trackingType`.
- `orderItems`: `manufacturingBaseCentsSnapshot`, `platformFeeCentsSnapshot`, `artistPayoutCentsSnapshot`, `physicalReleaseId`.
- `cartItems.physicalReleaseId` pattern → we add the merch twin.

**Enum extension:** `physicalFulfillmentStatusEnum` (#405: `not_applicable|pending|kunaki_processing|shipped|delivered|cancelled|failed`) gains **`printful_processing`** in our migration. (Post-merge cleanup option: generalize `kunaki_processing` → `fulfilling`; coordinate with the #405 owner, additive value is the zero-conflict path.)
**`webhookProviderEnum`** gains **`printful`** (#405 does not touch it — safe).

### 3.3 New tables (fulfillment.ts)

**`merch_catalog_products`** — curated blank snapshot (cache of `/v2/catalog-products/{id}`):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text PK` | Printful catalog product id (as text) |
| `name`, `type`, `brand`, `image`, `description` | `text` | Display + fan-facing copy |
| `techniques` | `jsonb` | `[{key, displayName, isDefault}]` |
| `placements` | `jsonb` | `[{placement, technique, layers[], placementOptions[]}]` — drives the placement picker + order item payloads |
| `mockup_style_ids` | `jsonb` | Selected style IDs (e.g. flat front) for mockup tasks |
| `print_file_rules` | `jsonb` | dpi, min/max dimensions per placement (from mockup styles: `dpi`, `print_area_*`) |
| `retail_min_cents`, `retail_max_cents` | `integer NOT NULL` | Category pricing bounds (Kunaki parity) |
| `is_curated` | `boolean default true` | The launch allowlist |
| `is_discontinued`, `synced_at` | `boolean`, `timestamp` | From catalog + `catalog_price_changed` |

**`merch_catalog_variants`** — physical blanks (cache of `/catalog-variants`):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text PK` | **Printful variant ID** — the only ID we ever order against |
| `catalog_product_id` | `text FK → merch_catalog_products` | |
| `name`, `size`, `color`, `color_code`, `image` | `text` | Variant metadata |
| `base_price_cents` | `integer NOT NULL` | Snapshot of variant price (COGS input) |
| `in_stock` | `boolean` | Refreshed by `catalog_stock_updated` + sweep |
| `availability` | `jsonb` | per-region/per-technique availability |
| `synced_at` | `timestamp` | |

**`merch_designs`** — the artist's product (one design on one blank style):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text PK` (uuid) | |
| `owner_user_id` | `text FK → user ON DELETE CASCADE` | Artist |
| `project_id` | `text FK → projects ON DELETE SET NULL` | Optional project tie-in (surfaces on the project page) |
| `title`, `description` | `text NOT NULL` / `text` | Fan-facing |
| `status` | `merchStatusEnum default 'draft'` | Draft → ready (mockups done) → published |
| `printful_catalog_product_id` | `text FK → merch_catalog_products` | Blank style |
| `technique` | `text default 'dtg'` | From catalog techniques |
| `placement` | `text NOT NULL` | e.g. `front`, `back` |
| `design_file_object_key` | `text NOT NULL` | R2 key under `merch/` (see 3.5) |
| `design_file_url` | `text` | Public `MEDIA_PUBLIC_URL`-based URL handed to Printful |
| `printful_file_id` | `text` | File Library id after `POST /v2/files` |
| `design_metadata` | `jsonb` | `{width, height, dpi, hasAlpha, format}` validated at upload |
| `retail_price_cents` | `integer NOT NULL` | Within `retail_min/max_cents` bounds |
| `platform_fee_bps` | `integer default 1200` | 12% (Kunaki parity) |
| `published_at`, `created_at`, `updated_at` | `timestamp` | |

Indexes: `owner_user_id`, `project_id`, `status`, unique partial index `(owner_user_id, printful_catalog_product_id, placement, design_file_object_key) WHERE status != 'archived'`.

**`merch_mockups`** — photorealistic preview per variant:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text PK` | |
| `merch_design_id` | `text FK → merch_designs ON DELETE CASCADE` | |
| `catalog_variant_id` | `text FK → merch_catalog_variants` | |
| `printful_task_id` | `text` | From `POST /v2/mockup-tasks` |
| `status` | `mockupTaskStatusEnum default 'queued'` | Queue → Printful → saved |
| `mockup_url` | `text` | Final photorealistic image URL (persist to our DB, not just Printful's CDN link) |
| `error` | `text` | `failure_reasons` |
| `created_at`, `updated_at` | `timestamp` | Unique `(merch_design_id, catalog_variant_id)` |

**`merch_fulfillments`** — isolated per-order fulfillment record (per readiness doc):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text PK` | |
| `order_id` | `text FK → orders ON DELETE CASCADE, UNIQUE` | 1:1 with SoundKit order |
| `external_id` | `text NOT NULL UNIQUE` | Our `orders.id` sent as Printful `external_id` |
| `printful_order_id` | `text UNIQUE` | Printful's numeric order id |
| `status` | `text` | `draft|confirmed|failed|canceled|on_hold` (+ reasons) |
| `printful_costs` | `jsonb` | Final cost snapshot `{subtotal, shipping, tax, vat, total, currency}` for reconciliation |
| `last_error` | `text` | |
| `confirmed_at`, `last_synced_at`, `created_at`, `updated_at` | `timestamp` | |

**`merch_shipments`** — tracking state (multi-shipment safe):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text PK` | |
| `fulfillment_id` | `text FK → merch_fulfillments ON DELETE CASCADE` | |
| `printful_shipment_id` | `text UNIQUE` | |
| `carrier`, `service`, `tracking_number`, `tracking_url` | `text` | Also denormalized onto `orders.trackingNumber/trackingType` (#405 columns) for cheap display |
| `status` | `text` | `in_transit|delivered|returned|canceled|out_of_stock` |
| `shipped_at`, `delivered_at` | `timestamp` | |
| `estimated_delivery` | `jsonb` | `{fromDate, toDate, calculatedAt}` |
| `tracking_events` | `jsonb` | `[{triggeredAt, description}]` |
| `departure_country`, `is_reshipment` | `text`, `boolean` | |
| `created_at`, `updated_at` | `timestamp` | |

### 3.4 Additive columns on existing tables

- **`cartItems`**: `merch_design_id text` (+ index), `printful_variant_id text` (+ index) — mirrors #405's `physical_release_id` (soft reference, snapshot-driven, no hard FK to keep cart rows durable).
- **`orderItems`**: `merch_design_id text` (+ index), `printful_variant_id text` — alongside #405's snapshot columns (`manufacturing_base_cents_snapshot` = Printful base cost, `platform_fee_cents_snapshot`, `artist_payout_cents_snapshot`).

### 3.5 Uploads

- `UploadIntentEntityType` (lib `upload-intents.ts`) gains `"merch"`; the `objectKeyFromMediaUrl` prefix regex gains `merch/` so design uploads live under `merch/{userId}/{uuid}.{ext}` in the media bucket.
- Print files must be fetchable by Printful's servers: use the standard `MEDIA_PUBLIC_URL` object URL (public artwork semantics — merch designs are published artwork), and additionally register the file with Printful's File Library at save time so later re-orders never depend on our URL staying online.

---

## 4. Architecture & Data Flow (Deliverable 2)

### 4.1 End-to-end flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. CURATED CATALOG SYNC (background)                                        │
│  alchemy env → lib/printful.ts → GET /v2/catalog-products/{id}/…            │
│    → merch_catalog_products + merch_catalog_variants (DB cache)             │
│    refreshed by catalog_stock_updated / catalog_price_changed webhooks      │
│    + daily scheduled sweep; fan/artist reads NEVER hit Printful             │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. ARTIST DESIGNS MERCH (dashboard, behind canSellProducts)                  │
│  a. Artist picks a curated blank + placement (from merch_catalog_* cache)   │
│  b. Uploads print file → better-upload → R2 merch/{userId}/… + uploadIntent  │
│     → server validates DPI/dimensions/transparency against print_file_rules │
│     → POST /v2/files (register; store printful_file_id)                     │
│  c. POST /v1/merch/designs → merch_designs (status: draft, retail within     │
│     bounds; payout preview = retail − 12% − base)                            │
│  d. Mockup pipeline: merch_mockups rows (queued) → CF Queue (≤2–4 tasks/min) │
│     → POST /v2/mockup-tasks → poll GET /v2/mockup-tasks +                   │
│       mockup_task_finished webhook → mockup_url saved → status: ready       │
│  e. Artist publishes → status: published (appears in fan shop)              │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. FAN BUYS (project page / merch section, VITE_ENABLE_MERCH)                │
│  Fan picks size + color → variant resolved from merch_catalog_variants      │
│    → addItem(productType: physical_merch, merchDesignId,                    │
│               printfulVariantId, priceCents snapshot) → cart                │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. CHECKOUT WITH LIVE SHIPPING                                              │
│  Cart drawer detects physical items → address form (US)                     │
│    → POST /v1/payments/shipping-quote {recipient, items}                     │
│    → server → POST /v2/shipping-rates → rates (carrier, cost, EDD)          │
│  Fan selects a rate → POST /v1/payments/checkout                            │
│    {cancelUrl, successUrl, idempotencyKey, shippingAddress, shippingRateId}  │
│  Server (single-seller rule unchanged):                                      │
│    orders (checkout_pending) + #405 shipping fields + shippingFeeCents      │
│    orderItems snapshots: retail, base, platformFee, artistPayout             │
│    Stripe destination checkout: line_items = items + "Shipping" line;      │
│    application_fee_amount = 12%·retail + Σbase + shipping  ──────────────── │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. PAID → PRINTFUL (durable)                                                │
│  Stripe webhook → orders.paid → PurchaseFulfillmentWorkflow                 │
│    existing steps (digital purchases/emails/notifications) + NEW steps:     │
│    "create printful draft"  POST /v2/orders (external_id = orderId,          │
│                              items external_id = orderItemId, retail_price,  │
│                              placements layers url = design_file_url)        │
│    "await costs"            poll until costs.calculation_status = done       │
│    "confirm printful order" POST /v2/orders/{id}/confirm →                   │
│                              merch_fulfillments (confirmed)                  │
│    orders.fulfillmentStatus = printful_processing                            │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. FULFILLMENT EVENTS (webhooks + sweep)                                    │
│  POST /v1/webhooks/printful (HMAC-SHA256 verified, webhookEvents audit)     │
│    shipment_sent    → merch_shipments + orders.trackingNumber/shippedAt,     │
│                       fan "Your merch has shipped" email + notification      │
│    shipment_delivered / returned / out_of_stock / canceled → status updates  │
│    order_failed / put_hold / refunded → merch_fulfillments + artist alert    │
│  Scheduled sweep reconciles in-flight orders (GET /v2/orders/{id}/shipments)│
│  Fan tracks in /library/purchased; artist sees unit sales in career/payments│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Money flow (worked example — hoodie)

| Amount | Value |
| --- | --- |
| Artist retail price | $45.00 |
| Printful base (variant) | $24.50 |
| Fan-selected shipping (STANDARD, EDD shown) | $6.49 |
| **Fan pays (Stripe charge)** | **$51.49** |
| Stripe `application_fee_amount` | $5.40 (12%) + $24.50 (base) + $6.49 (shipping) = **$36.39** |
| **Artist nets (via destination charge)** | **$15.10** = retail − 12% − base |
| Platform keeps | $5.40, pays Printful invoice (base + shipping + tax) from the master Printful wallet |

Rules:
- **Exact shipping pass-through** (Kunaki parity): `orders.shippingFeeCents` = the rate the fan selected; Printful invoices that shipping amount. Shipping price drift between quote and confirm is a known Printful edge — the confirm step's cost snapshot is compared and large deltas flag the order for review instead of silently eating margin.
- **Printful's sales tax** is a merchant-of-record cost SoundKit absorbs inside its 12% in v1 (US-only). Follow-up: enable Stripe Tax for explicit fan-facing tax collection, then route the tax line into the charge.
- Retail bounds per blank (`retail_min/max_cents`) guarantee `artistPayout ≥ floor`; the designer UI shows a live payout preview (mirrors the #405 "Monetize Slot" preview).
- `transactions.artistAmountCents` = Σ artist payouts + 0·shipping; `platformFees` row keeps the 12%; COGS lives in `orderItems.manufacturingBaseCentsSnapshot` so finance dashboards can reconcile Printful invoices against order rows.

---

## 5. Frontend Requirements (Deliverable 3)

All fan-facing surfaces ship behind `featureFlags.merch` (`VITE_ENABLE_MERCH=true` per environment).

### 5.1 New components

| Component | Location | Purpose |
| --- | --- | --- |
| `merch-designer.tsx` | `apps/website/src/components/dashboard/` | Artist studio: curated blank picker (cards with blank images), artwork upload (better-upload flow with `merch/` intent, DPI/size/transparency validation + errors), placement selector, retail price input with bounds + **live payout preview**, "Generate mockups" action, mockup gallery with per-variant previews, publish toggle. |
| `merch-shelf.tsx` | `apps/website/src/components/explore/` | Fan-facing product card grid: mockup image, title, price, size + color selectors (variant resolution client-side from catalog cache payload), add-to-cart. Used on the project page (and later artist bio). |
| `shipping-address-form.tsx` | `apps/website/src/components/` | US address fields (name, address1/2, city, state dropdown from `country-regions.ts`, zip) with validation; part of checkout when `requiresShipping`. |
| `shipping-rate-selector.tsx` | `apps/website/src/components/` | Rate list (method name, cost, EDD range) fetched from the shipping-quote route; selection feeds checkout. |
| `order-tracking.tsx` | `apps/website/src/components/` | Carrier + tracking number + tracking URL + EDD + event timeline for physical purchases (fan library + artist order views). |

### 5.2 Modified components

| File | Change |
| --- | --- |
| `components/cart-provider.tsx` | `CartItem` extends: `productType: "physical_merch"`, `purchaseMode: "physical_merch"`, `merchDesignId`, `printfulVariantId`, `size`, `color`, `previewImageUrl`, `requiresShipping`. Claim/merge logic extended. |
| `components/cart-drawer.tsx` | Physical badges ("Apparel — printed on demand", like #405's `[Audio CD]` badges), shipping-required banner, the new address + rate steps before the existing checkout POST (payload gains `shippingAddress` + `shippingRateId`), shipping shown as a line before total. |
| `app/_explore/projects/$id/index.tsx` | "Merch" section (published designs for the project via the public project payload) rendering `merch-shelf.tsx` next to the existing Buy/digital CTA. |
| `app/dashboard/career/payments.tsx` | Unit-sales breakdown gains merch rows (base cost, platform fee, artist payout) + fulfillment status — extends the #405 breakdown so physical media and apparel share one view. |
| `components/dashboard/new-project-form.tsx` | Inside the monetize accordion (≈ lines 1864–1969): subtle "Sell merch of this release" CTA linking to the merch designer with the project prefilled (slots in beside #405's physical releases entry point). |
| `app/dashboard/*` routing | Merch management route (e.g. `app/dashboard/merch.tsx`) — designer + design list (status, mockups, publish) — gated on `canSellProducts` + feature flag; sidebar nav entry. |
| `app/library/purchased/*` | Physical purchase cards render `order-tracking.tsx` (tracking arrives via webhooks). |

### 5.3 Not in v1 (explicit)

- In-browser canvas editor (Fabric.js or Konva) — v2 follow-up; the placement/position data model (`placements[].layers[].position`) already supports it.
- soundkit.bio merch tab, full Printful catalog browsing, international addresses.

---

## 6. Backend API Endpoints (Deliverable 4)

New route files: `apps/server/src/routes/merch.ts` (mounted `/v1/merch`), `apps/server/src/routes/webhooks-printful.ts` (mounted `/v1/webhooks/printful`, mirroring `webhooks-stripe.ts` naming), plus targeted extensions to `cart.ts`, `payments.ts`, `projects.ts`. Fulfillment business logic lives in `apps/server/src/lib/printful.ts` + `lib/fulfillment-printful.ts` (readiness doc's isolation boundary; route files stay thin).

### 6.1 Artist / authenticated

| Method & path | Body / response | Behavior |
| --- | --- | --- |
| `GET /v1/merch/catalog` | → curated blanks + variants + placements + bounds | Served from `merch_catalog_*` cache only. Requires auth + `canSellProducts`. |
| `POST /v1/merch/designs` | `{projectId?, printfulCatalogProductId, placement, technique?, designFileObjectKey, retailPriceCents, title, description?}` → `merchDesign` | Validates bounds + print-file rules against cache; registers file with Printful (`POST /v2/files`); inserts `merch_designs` (draft); enqueues mockup rows for all in-stock variants of the blank. |
| `GET /v1/merch/designs` | → artist's designs + mockup statuses | Owner-scoped. |
| `PATCH /v1/merch/designs/{id}` | `{title?, description?, retailPriceCents?, status?}` | Draft/ready edits; `published` only when mockups completed; price re-bounds check. |
| `DELETE /v1/merch/designs/{id}` | | Archive (soft) — fan shop hides; existing order items unaffected (snapshots). |
| `POST /v1/merch/designs/{id}/mockups` | → `{queued: n}` | Regenerate mockups (new variants, refresh); rate-limited by queue depth. |
| `GET /v1/merch/designs/{id}/mockups` | → per-variant mockup rows | Polled by the designer UI. |

### 6.2 Fan-facing (public)

| Method & path | Behavior |
| --- | --- |
| `GET /v1/projects/public/{projectId}` | Response gains `merch: [{id, title, retailPriceCents, previewMockupUrl, catalogProductId, variants: [{id, size, color, colorCode, image, inStock}]}]` for published designs (mirrors #405's physical editions addition). Cached responses invalidated on publish. |
| `GET /v1/merch/{designId}/public` | Single-design detail (bio/standalone use later). |

### 6.3 Cart & checkout

| Method & path | Change |
| --- | --- |
| `POST /v1/cart/items` + `POST /v1/cart/claim` (`routes/cart.ts`, `lib/schemas.ts`) | `addCartItemBodySchema` gains `productType: "physical_merch"` with `merchDesignId` + `printfulVariantId`; server re-snapshots retail from `merch_designs` (never trusts client price), stores variant binding, sets `sellerUserId` from the design owner. `toCartResponse` surfaces merch fields + `requiresShipping` on the cart. |
| `POST /v1/payments/shipping-quote` (new) | `{recipient{name, address1, address2?, city, stateCode, zip}, items?}` — defaults items to the caller's cart. Server → `POST /v2/shipping-rates` with the cart's variant/quantity set + currency USD. Response: `[{id, shipping, shippingMethodName, rateCents, minDeliveryDays, maxDeliveryDays, minDeliveryDate, maxDeliveryDate}]`. Quotes cached briefly per (recipient hash + cart hash) to respect the leaky bucket on repeated edits. |
| `POST /v1/payments/checkout` (extended) | Body gains optional `shippingAddress` + `shippingRateId` — **required** when the cart contains `physical_merch` items (400 otherwise). Order creation persists #405's shipping columns + `shippingFeeCents` from the cached quote; order-item economics snapshots (base/fee/payout) written at this point; Stripe session adds a "Shipping" line item and sets `application_fee_amount = platformCut + Σbase + shipping`. Digital-only carts flow unchanged. |
| `GET /v1/payments/orders/{orderId}` (new) | Authenticated buyer/seller view: order + items + `merch_fulfillments` status + `merch_shipments` tracking — powers `order-tracking.tsx`. |

### 6.4 Webhooks & admin

| Method & path | Behavior |
| --- | --- |
| `POST /v1/webhooks/printful` (new `webhooks-printful.ts`) | Raw-body HMAC-SHA256 verification (`x-pf-webhook-signature`, hex-decoded `PRINTFUL_WEBHOOK_SECRET`, WebCrypto, constant-time); rejects invalid signatures (logged, ignored); records to `webhookEvents` (provider `printful`); idempotent set-based handlers for the event list in §2.1. HTTPS enforced by Printful on their side; our route is public (like `/v1/webhooks/stripe-commerce`) and session-middleware exempt. |
| `POST /v1/admin/merch/sync-catalog` | Admin-triggered refresh of curated `merch_catalog_*` from Printful (backfill + recovery). |
| `GET /v1/admin/merch/fulfillments` | Ops view of `merch_fulfillments` (stuck drafts, failed confirms, cost deltas). |

### 6.5 Background jobs (apps/server)

| Surface | Change |
| --- | --- |
| `PurchaseFulfillmentWorkflow` (`workflows/purchase-fulfillment.ts`) | New steps after "grant purchases": `create printful draft order` → `await printful costs` (poll w/ step-sleep) → `confirm printful order` → upsert `merch_fulfillments`, set `orders.fulfillmentStatus = printful_processing`. All steps idempotent (skip when `printfulOrderId` already exists / already confirmed). Digital-only orders skip via a cheap order-item check. |
| New CF Queue `merch-mockup-tasks` (+ DLQ) | Consumer (maxConcurrency 1, small batches) creates Printful mockup tasks below the 2–10/min ceiling; `merch_mockups` rows are the durable backlog; consumer also polls recently-pending tasks. |
| `scheduled` handler (`index.ts`) | Add `runPrintfulFulfillmentReconciliation()` (status pull for in-flight orders — webhook safety net, mirrors `runCheckoutReconciliation`), `runPrintfulCatalogSync()` (daily), and a stale-mockup-task poll. |
| `alchemy.run.ts` (`packages/infra`) | New bindings: `PRINTFUL_API_KEY`, `PRINTFUL_STORE_ID`, `PRINTFUL_WEBHOOK_SECRET` (all `optionalEnvBinding(...)` → routes answer explicit "not configured" errors, matching the upload-routes pattern; production required-check mirrors `requireR2UploadCredentials` at deploy time), plus the mockup queue + consumer resources. `.env.example` entries for `apps/server`. |

---

## 7. Security & Secrets

1. **`PRINTFUL_API_KEY`** never reaches the client. It lives in `apps/server/.env` (git-ignored), is bound through `alchemy.run.ts`, and is read server-side via `env` (`cloudflare:workers`) using the established `getEnvValue` pattern. The website only ever talks to our `/v1/*` routes.
2. **`PRINTFUL_WEBHOOK_SECRET`** is stored server-side; verification is mandatory — events with bad/missing signatures are discarded and logged.
3. **Token lifecycle:** Private Tokens expire and cannot be auto-refreshed — runbook: calendar reminder before expiry, rotate via Developer Portal, update the secret, redeploy. `401`s surface as structured warnings.
4. **Client trust boundaries:** retail prices are re-snapshotted server-side on cart add; variant IDs are validated against the curated cache; webhook payloads are never trusted for money math (only for status/tracking updates — money was fixed at checkout).
5. **No Printful keys in logs** — the printful client redacts auth headers from structured logging.

---

## 8. Implementation Milestones (PR sequence)

Each PR: branch off updated `master`, `bun run verify` green, `CHANGELOG.md` entry, PR title matching the issue title (or its milestone subsection), preview deployment left for human review (never auto-merged).

| PR | Scope | Key files |
| --- | --- | --- |
| **M1 — Schema** (after #405 merges; takes migration `0065`) | `fulfillment.ts` schema + enums + cart/order-item columns + `webhookProviderEnum`/`physicalFulfillmentStatusEnum` extensions + `upload-intents` merch type | `packages/db/src/schema/fulfillment.ts`, `app.ts`, `commerce.test.ts`-style `fulfillment.test.ts`, migrations |
| **M2 — Client + catalog cache** | `lib/printful.ts` (v2 client, 429/Retry-After, header-aware), curated catalog sync job + admin route, env/alchemy bindings | `apps/server/src/lib/printful.ts`, `routes/admin.ts`, `packages/infra/alchemy.run.ts` |
| **M3 — Designer + mockups** | Upload intent `merch/`, design CRUD routes, File Library registration, mockup queue + consumer + poll sweep, webhook `mockup_task_finished` | `routes/merch.ts`, `lib/fulfillment-printful.ts`, queue consumer, `webhooks-printful.ts` |
| **M4 — Storefront + cart** | Public merch payloads, project-page merch section, cart provider/drawer merch fields + badges | `routes/projects.ts`, `schemas.ts`, `cart.ts`, website components |
| **M5 — Checkout + fulfillment** | Shipping-quote route, checkout extension (address, shipping line, app-fee math), workflow steps, fulfillment/shipment persistence, order-level webhooks, notifications/emails, tracking UI | `routes/payments.ts`, `workflows/purchase-fulfillment.ts`, `webhooks-printful.ts`, website checkout components |
| **M6 — Analytics + polish + flag flip** | career/payments breakdown, admin ops view, reconciliation sweep hardening, `VITE_ENABLE_MERCH=true` in alchemy for production | `payments.tsx`, `alchemy.run.ts` |

**Testing strategy (every milestone):** unit tests for pricing/fee math (bounds, app-fee composition, payout snapshot), printful client (429 backoff, Retry-After, RFC 9457 errors, header parsing), HMAC verification vectors; worker tests (`@cloudflare/vitest-pool-workers`) for routes with mocked `fetch`; cart/checkout flow tests incl. mixed digital+merch carts; Playwright E2E for shop → cart → address → rate selection with a mocked Printful. `bun run verify` is the gate.

---

## 9. Coordination with #405 (Kunaki)

| Shared asset | Owner | Rule |
| --- | --- | --- |
| Migration `0064` | #405 | This plan's schema PR waits for #405 to merge, then rebases and takes `0065`. |
| `orders` shipping/tracking columns, `physical_merch` product type, order-item snapshot columns | #405 defines; this plan consumes | No redefinition; only additive merch columns. |
| `physicalFulfillmentStatusEnum` | #405 defines (`kunaki_processing`) | We add `printful_processing` (additive, zero conflict). Optional post-merge cleanup: generalize to a single `fulfilling` value. |
| Cart drawer physical badges + `requiresShipping` UX | Both | One shared "physical item" presentation path keyed on `productType: physical_merch`, with per-provider subtext (`[Audio CD]` vs `[Apparel]`). Coordinate the `CartItem` type extension in one place to avoid double edits to `cart-provider.tsx`. |
| career/payments unit-sales breakdown | Both | #405 builds the breakdown over snapshot columns; merch rows flow through the same query once M6 lands. |

---

## 10. Open Questions / Follow-ups

1. **Packing slips** — Printful `customization.packing_slip` supports `store_name`, `logo_url`, `custom_order_id`, and a message. Proposal: `store_name: "SoundKit — {artistName}"` with the SoundKit logo and the SoundKit order id; needs a brand call before M5.
2. **Printful wallet funding** — Printful invoices the master account on confirm (base + shipping + tax). Ops: keep the wallet auto-topped-up; the application-fee recovery funds it. Alerting on low balance is an ops task, not code.
3. **Sales tax** — v1 platform absorbs tax inside the 12% (US-only). Follow-up: Stripe Tax for explicit fan-facing tax lines.
4. **Token rotation date** — record the Private Token's expiry when it's minted; add a calendar reminder (tokens are not refreshable).
5. **Bio merch surface** — soundkit.bio merch tab deferred (the public single-design route in M4 is the seam).
6. **Shipping-cost drift** — if Printful's confirmed shipping differs from the quoted rate, log + flag in the admin ops view; consider re-quoting at confirm for large deltas (rare, US domestic).
