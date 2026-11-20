# Visual merch creation (#554)

The creator flow supports one artwork layer on one provider-defined, simple DTG placement per design. It uses cached Printful print-area dimensions and DPI from `printFileRules`; unsupported techniques or missing templates stay unavailable instead of inventing placement coordinates. Refresh curated products in the admin catalog to obtain current templates.

Artwork uploads use the authenticated media service and immutable generated object keys. The editor stores artwork dimensions, selected variants and position in inches in existing `design_metadata`; no database migration is needed. Both mockup tasks and paid fulfillment use the same positioned-layer builder. Once a design has been published, its artwork stays locked even after unpublishing, protecting existing orders.

The scheduled sweep submits at most two queued mockup tasks per five-minute run, polls pending tasks, and recovers abandoned submission claims. Generation therefore takes time; creators may leave and reopen their saved draft. Retry resets failed tasks and preserves completed work. Preview environments without scheduled jobs/provider credentials cannot generate real provider mockups.

Publication requires completed mockups for every selected variant and a processed Printful file whose URL, dimensions and MIME type match the saved artwork. Provider failures remain visible. Pricing displays cached base-cost estimates and the saved platform fee; shipping/taxes are calculated at checkout. Production confirmation remains a post-payment server operation.

The public cart carries the merch design and variant IDs. The server validates product visibility, selected variants, availability and current price before checkout. Physical Kunaki editions still require external title setup and a linked product before sale; this change does not publish Kunaki titles or submit test manufacturing orders.

Provider references: [Printful v2 beta](https://developers.printful.com/docs/v2-beta/), [Kunaki XML fulfillment](https://kunaki.com/xmlservice.htm).

---

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
