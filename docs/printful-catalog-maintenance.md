# Enabling matching Printful blanks

The manual `Infra Maintenance` workflow has a `printful-catalog` task. Its default is a read-only provider audit. `apply_printful_catalog=true` additionally upserts verified products and variants into the production catalog using the existing repository credentials. It does not create designs, publish creator products, or place fulfillment orders.

The allowlist in `scripts/ci/printful-catalog-candidates.json` records 85 Fourthwall brand/model candidates and their public source URLs, gathered with Firecrawl on November 20, 2026. Public-index matches are only candidates: the live run requires an exact normalized brand and model, one unambiguous product, a simple DTG print area with dimensions/DPI and mockup styles, positive USD DTG pricing, and explicit US stock availability. Other techniques, missing templates, unavailable products and alternatives are reported without enabling them.

The audit reads every product, variant, availability and price page. Identical mockup-style groups can repeat in Printful responses; they are deduplicated while retaining pagination checks. Provider errors prevent applying the audit.

An apply run uses one database transaction per product, updates cached stock and production metadata, preserves existing retail minimums/maximums and unrelated products, and verifies the enabled flag and in-stock variant count before committing. New products use the same base-cost retail-bound formula as admin enabling. Logs and the job summary record the verified public models and before/after curation/pricing state, without credentials. If a later transaction fails, earlier committed products remain enabled; rerunning is idempotent.

The task is independent of the creator editor deployment. The editor in #555 consumes the cached provider print-area rules. Kunaki titles still require separate setup/linking.
