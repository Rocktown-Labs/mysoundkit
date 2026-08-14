## Recommended Connect integration

### A. Account configuration

- Accounts API: `/v2/core/accounts`
- Legacy account `type`: not used
- Dashboard: Express
- Fee collection: SoundKit manages pricing (`fees_collector: "application"`)
- Negative balance liability: SoundKit (`losses_collector: "application"`)

Each artist connected account uses recipient configuration (`configuration.recipient`) with `stripe_transfers` on `stripe_balance` requested. Marketplace connected accounts do not request merchant configuration or `card_payments`, which avoids unnecessary onboarding requirements.

### B. Charge pattern: destination charges

SoundKit owns the checkout flow and customer payment relationship for track, project, video, community, and tip purchases. Each checkout has one artist recipient, so destination charges automatically transfer the artist share while SoundKit retains its application fee.

### C. Artist onboarding flow

Onboarding method: Stripe-hosted Account Links.

Artist Premium activation reveals the Career Payments page and setup banner. SoundKit creates an Accounts v2 recipient account, redirects the artist through Stripe-hosted onboarding, then continually checks recipient transfer capability and outstanding requirements. Purchases remain disabled until `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status` is `active`.

### D. Payments dashboard access for artists

Artists receive Express Dashboard access and use SoundKit's embedded Payments page for routine payment, payout, report, requirement, and account-management workflows.

### E. Embedded components

- `notification_banner`
- `account_management`
- `payments`
- `payouts`
- `payout_reconciliation_report`

Destination charges provide reduced artist-side dispute and refund detail. SoundKit must own webhook-driven dispute recovery and transfer reversals.

### F. Webhook integration

Use verified Stripe webhooks as the source of truth for payment completion, connected-account state, disputes, refunds, and subscription activation.

### G. Onboarding status gating

Before creating Checkout destination transfers, retrieve the connected account and require `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status === "active"`; never rely on legacy `charges_enabled` or `payouts_enabled` fields.

### H. Fee structure

- Product platform fee: 10%
- Tip platform fee: 5%
- `applicationFeeIncludes`: `platform_fee_only`
- SoundKit currently absorbs Stripe processing fees from its retained application fee.

```text
Fan pays purchase total
      │
      ▼
SoundKit platform ─── retains 10% minus Stripe processing fees
      │
      ▼
Artist connected account ─── receives 90%
```

Destination charges make SoundKit responsible for Stripe processing fees. Validate margins against [Stripe pricing](https://stripe.com/pricing), use the [Platform Pricing Tool](https://dashboard.stripe.com/settings/connect/platform_pricing) only if explicit `application_fee_amount` is removed, and monitor the [margin report](https://docs.stripe.com/connect/margin-reports.md).

### I. SaaS monetization

SoundKit Premium subscriptions are platform subscriptions and remain separate from artist connected accounts. Connected accounts are recipients of marketplace transfers, not customers being billed for a SaaS service, so `customer_account` is not used for Premium billing.

### J. Implementation plan

1. Create Accounts v2 recipient accounts with Express access and SoundKit-owned fee and negative-balance responsibility.
2. Use Stripe-hosted Account Links and show setup/remediation prompts to Premium artists.
3. Provide embedded payment, payout, reconciliation, notification, and account components.
4. Gate destination Checkout on active transfer capability and process payment completion through webhooks.
5. Reverse destination transfers during dispute recovery and validate end-to-end test/live-mode Checkout.

### K. Risk and liability

- Negative balance liability owner: SoundKit.
- Risk controls owner: SoundKit, supported by Stripe Radar.
- Caution: Express artists have limited dispute/refund visibility for destination charges, so SoundKit must operate refund, dispute, and transfer-reversal workflows.

### L. Why this fits SoundKit

- Fans complete purchases through SoundKit rather than independent artist storefronts.
- Each transaction currently has one artist recipient.
- SoundKit already calculates a marketplace fee and owns payment support.
- Stripe-hosted onboarding minimizes KYC maintenance while embedded components keep daily payment management inside SoundKit.

### M. Confirmed decisions

- SoundKit manages Connect pricing.
- SoundKit accepts connected-account negative balance liability.
- Artists use Stripe-hosted onboarding and embedded payment management.
