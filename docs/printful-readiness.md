# Printful Fulfillment Readiness

Printful fulfillment is intentionally outside the payments and paid
communities release. SoundKit remains the merchant-facing checkout owner and
revenue ledger.

## Future Flow

1. SoundKit presents provider-neutral products in its catalog and owns the
   customer cart and Stripe checkout.
2. A paid webhook finalizes the immutable SoundKit transaction and order.
3. Digital items remain marked with fulfillment provider `none`.
4. Paid physical items marked `printful` are submitted to Printful after
   payment, using their nullable provider reference to connect SoundKit and
   Printful records.
5. Printful status and tracking webhooks update isolated fulfillment records.

Reserved provider values are `none`, `manual`, and `printful`. The current
release does not expose Printful credentials, catalog sync, shipping quotes,
merch UI, API calls, or webhooks.

A future implementation should remain isolated in modules such as:

- `packages/db/src/schema/fulfillment.ts`
- `apps/server/src/routes/fulfillment-printful.ts`
- `apps/server/src/lib/printful.ts`
