# SoundKit Monetization Plan

## Current Repo Fit

SoundKit already has the product surfaces needed for monetization: Better Auth, fan and artist profiles, Stripe Billing, Stripe Connect seller onboarding, orders, purchases, Mux videos, R2 uploads, live rooms, listening parties, battles, discovery, embeddings, recent plays, and analytics rollups.

The missing layer is not another player or checkout flow. It is an auditable reward economy that can turn eligible engagement, video ads, purchases, and future live bonuses into estimates, finalized earnings, statements, ledger records, and payout decisions.

## Product Rules

Premium is one membership concept for live access, but account capability still matters.

- Fan Premium can watch live streams, join listening parties, watch live battles, vote where allowed, watch VOD, and generate eligible engagement.
- Fan Premium must not unlock uploading, selling, creator payouts, or creator monetization by itself.
- A fan should be able to convert into an artist account through artist onboarding.
- Artist accounts can upload and configure monetization when their profile, rights, and payout setup are complete.
- Free users can stream audio with ads, browse discovery, buy music, upload only after becoming artist accounts, and watch VOD playback.
- Free users cannot watch live streams, attend live listening parties in real time, vote in live battles, or join live chat.

The current code has separate plan codes for `listener_premium`, `artist_premium`, `artist_team`, and `fan_family`. The target model should evolve toward shared Premium entitlement keys for live access while keeping artist upload and seller capabilities tied to artist account state.

## Revenue Sources

Initial monetization lanes:

- Premium Creator Rewards funded by successful paid Premium periods.
- Video advertising on VOD/video surfaces.
- Product purchases through existing checkout.
- Tips through existing payment primitives.
- Community subscriptions through existing community billing.

Future lanes:

- Live reward pools.
- Battle bonus pools.
- Sponsored listening parties.
- State-targeted artist promotions.
- Community-targeted or genre-targeted promotion inventory.

## Creator Rewards

Use a user-centric pool. A configured amount from each successfully paid Premium period funds that member's Creator Rewards allocation.

Initial defaults:

- Premium price: 1999 cents monthly.
- Creator Rewards allocation: 500 cents per funded monthly Premium period.
- Settlement cadence: monthly.
- Estimates: daily.
- Reserve period: 30 days after finalization.
- Minimum payout: 2500 cents.
- Currency: USD only.
- Unused allocation strategy: return to platform until product decides otherwise.

Formula:

```text
creatorReward =
  subscriberFundedAllocation
  * creatorEligibleUnitsForSubscriber
  / totalEligibleUnitsForSubscriber
```

This keeps liability capped by funded allocations. A member with 500 eligible units creates about a one-cent effective rate. A member with 1,000 eligible units creates a half-cent effective rate. A member with 100 eligible units creates a five-cent effective rate.

Do not market this as a guaranteed one cent per stream. Safer language:

```text
A portion of every Premium membership funds Creator Rewards.
Qualified engagement determines how that member's contribution is
distributed among eligible creators.
```

## Qualified Streams

A raw play is not payable by itself.

Initial qualified stream rule:

- Authenticated listener.
- Active funded Premium entitlement at playback time.
- Track is public and monetizable.
- Track owner or eligible payee is known.
- Listener is not the owner.
- Listener is not a collaborator with a financial interest.
- Playback reaches 30 seconds or 50% of duration, whichever comes first.
- Playback is not muted for the full qualification window.
- Playback is tied to a server-created session.
- Same listener and track do not qualify more than once in a rolling 24-hour window.
- Risk status is not rejected or held.

Listening parties and battles can create normal track-level qualified streams when the same rules pass. Joining a room, chatting, or voting should not directly create Creator Rewards during the first rollout.

## Video Ads

Ads should start on videos and VOD, not audio playback.

Supported inventory:

- Full video overlay.
- Bottom overlay or bottom carousel similar to social video ads.
- Sponsored video placements.
- Future state, genre, community, or artist-targeted campaigns.

Financial rule:

```text
adCreatorPool =
  recognizedNetAdRevenue
  * configuredCreatorShareBasisPoints
  / 10000
```

Only recognized paid ad revenue should fund ad-supported creator rewards. House ads and unpaid internal promotions can produce analytics, but not revenue-backed earnings.

## Fan Value

Fan Value is an analytics score, not money owed to a fan.

Track Fan Value both globally and as fan-to-artist relationships. Useful signals include qualified streams, repeat valid plays, follows, saves, purchases, tips, Premium renewals, live attendance, battle votes, chat participation, shares, state discovery, and new artist discovery.

Use caps and score versions so spam-prone activity cannot dominate.

Initial tiers:

- `new`
- `casual`
- `engaged`
- `high_value`
- `superfan`

## Settlement Model

Settlement should be idempotent and restartable.

Stages:

1. Open accounting period.
2. Freeze cutoff.
3. Validate funded subscription allocations.
4. Reconcile refunds and disputes.
5. Load eligible reward units.
6. Exclude held or rejected risk events.
7. Allocate user-centric rewards.
8. Apply rightsholder splits.
9. Hold incomplete or disputed splits.
10. Write calculation snapshots.
11. Write balanced ledger transactions.
12. Create creator earnings.
13. Generate statements.
14. Mark period ready for review.
15. Finalize after admin approval.
16. Make balances payable after reserve period.
17. Batch Stripe Connect transfers.
18. Reconcile payout success or failure.

## Implementation Phases

1. Monetization documentation and schema foundation.
2. Account capability separation: Premium live access versus artist upload/seller eligibility.
3. Playback sessions and server-side qualification events.
4. Reward units and analytics rollups.
5. Fan Value events and fan-artist relationship rollups.
6. Rightsholder splits.
7. Funding allocations from Stripe subscription events.
8. Ledger and settlement workflow.
9. Creator statements and admin finance review.
10. Stripe Connect reward payouts.
11. Video ad campaigns, impressions, and ad revenue allocation.
12. Live rewards and battle bonus pools if enabled.

## Open Questions

- Should `listener_premium` and `artist_premium` remain separate Stripe prices while sharing the same live entitlement keys?
- Should existing fan uploads be impossible at the upload route, track/project creation routes, or both?
- Should self-stream and collaborator stream detection use only direct track ownership at launch, or should it wait for rightsholder split records?
- Should unused Premium allocations return to platform or fund a global/regional discovery pool?
- Which ad provider will validate impressions, or should the first release track internal direct-sold campaigns only?
