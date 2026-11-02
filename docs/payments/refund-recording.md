# Confirmed Stripe refund recording (#509)

The commerce webhook retrieves the current charge and paginated individual
Refund objects from Stripe. It records only `succeeded` refunds with real `re_`
IDs and their own integer amounts/currency, using the existing unique constraint
and a transaction-row lock. Partial, pending, canceled and failed refunds do not
mark a payment fully refunded. Known duplicate facts are validated, not updated.

A refund arriving before Checkout settlement must prove the stored Checkout
Session owns its PaymentIntent. The filtered Stripe Session lookup works without
charge metadata; metadata alone cannot establish the binding.
Confirmed captured payments and refund facts commit atomically. Full refunds
mark transaction/order refunded, and late Checkout events cannot downgrade that
state or restart fulfillment/transfers after that state is visible.

This path uses Stripe GET requests only. It never issues refunds, reverses or
creates transfers, or changes digital-access/refund policy. Provider failures or
contradictory facts fail the webhook for retry/reconciliation. If a previously
recorded refund later becomes unsuccessful, it is surfaced as a reconciliation
error rather than silently deleting or overwriting historical money facts.

After deployment, run Infra Maintenance task `stripe-refund-events` in dry-run
mode, then with `apply_refund_events=true`. It targets only existing enabled
`https://api.mysoundkit.com/v1/webhooks/stripe-commerce` endpoints, preserving all
current subscriptions and webhook signing secrets. It does not create endpoints.
Required events are charge.refunded, charge.refund.updated, refund.created,
refund.updated and refund.failed. A wildcard subscription already covers them.

## Historical reconciliation plan

Legacy `ch_`-shaped payment_refunds rows remain untouched. The #500 exporter
quarantines them; do not sum those rows as confirmed individual refunds. Before
any historical repair, enumerate affected transactions in a protected report,
read all provider refunds for their bound PaymentIntents/accounts, compare actual
successful `re_` IDs/amounts/currencies against stored facts, and separately list
failed/pending facts and amount/status discrepancies. Review an exact proposed
mapping and rollback before database writes. Do not rerun refund, fulfillment,
transfer or payout operations. No historical repair is performed by this release.

Analytics uses observed application transitions, not a backfilled provider
settlement ledger. No full historical net-revenue completeness claim is made.

References: https://docs.stripe.com/api/refunds/object,
https://docs.stripe.com/api/refunds/list, https://docs.stripe.com/refunds,
https://docs.stripe.com/webhooks#event-ordering.
