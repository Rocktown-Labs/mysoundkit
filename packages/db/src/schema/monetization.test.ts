import { describe, expect, it } from "vitest";

import {
  accountingPeriodStatusEnum,
  adImpressionStatusEnum,
  creatorEarnings,
  fanArtistRelationships,
  fanValueTierEnum,
  ledgerEntries,
  ledgerTransactions,
  payoutHoldStatusEnum,
  qualifiedStreams,
  recordingRightsholders,
  rewardConfigurationVersions,
  rewardUnitTypeEnum,
  rewardUnits,
  subscriptionRewardAllocations,
  videoAdCampaigns,
  videoAdImpressions,
} from "./app";

describe("monetization schema foundation", () => {
  it("models creator rewards as funded allocations before earnings", () => {
    expect(subscriptionRewardAllocations.creatorAllocationCents.notNull).toBe(
      true
    );
    expect(
      subscriptionRewardAllocations.grossSubscriptionAmountCents.notNull
    ).toBe(true);
    expect(subscriptionRewardAllocations.stripeInvoiceId.notNull).toBe(false);
    expect(accountingPeriodStatusEnum.enumValues).toContain("finalized");
    expect(accountingPeriodStatusEnum.enumValues).toContain("payable");
  });

  it("keeps qualification and reward units separate from raw playback", () => {
    expect(qualifiedStreams.qualificationWindowKey.notNull).toBe(true);
    expect(qualifiedStreams.ruleVersion.notNull).toBe(true);
    expect(rewardUnits.weightBasisPoints.notNull).toBe(true);
    expect(rewardUnitTypeEnum.enumValues).toContain("premium_track_stream");
    expect(rewardUnitTypeEnum.enumValues).toContain("ad_supported_video_view");
  });

  it("stores Fan Value as analytics, not a cash balance", () => {
    expect(fanArtistRelationships.lifetimeScore.notNull).toBe(true);
    expect(fanArtistRelationships.netPurchaseValueCents.notNull).toBe(true);
    expect(fanValueTierEnum.enumValues).toEqual([
      "new",
      "casual",
      "engaged",
      "high_value",
      "superfan",
    ]);
  });

  it("uses basis points and effective dates for recording rightsholders", () => {
    expect(recordingRightsholders.shareBasisPoints.notNull).toBe(true);
    expect(recordingRightsholders.splitVersion.notNull).toBe(true);
    expect(recordingRightsholders.effectiveFrom.notNull).toBe(true);
    expect(recordingRightsholders.effectiveTo.notNull).toBe(false);
  });

  it("provides immutable ledger primitives with idempotency", () => {
    expect(ledgerTransactions.idempotencyKey.notNull).toBe(true);
    expect(ledgerEntries.amountCents.notNull).toBe(true);
    expect(ledgerEntries.side.notNull).toBe(true);
    expect(creatorEarnings.ledgerTransactionId.notNull).toBe(false);
  });

  it("tracks video ad inventory without recognizing unpaid promos as revenue", () => {
    expect(videoAdCampaigns.inventoryType.notNull).toBe(true);
    expect(videoAdCampaigns.budgetCents.notNull).toBe(false);
    expect(videoAdImpressions.impressionValueCents.notNull).toBe(true);
    expect(adImpressionStatusEnum.enumValues).toContain("invalid");
    expect(adImpressionStatusEnum.enumValues).toContain("credited");
  });

  it("centralizes adjustable business defaults in versioned config", () => {
    expect(rewardConfigurationVersions.creatorAllocationCents.notNull).toBe(
      true
    );
    expect(rewardConfigurationVersions.minimumPayoutCents.notNull).toBe(true);
    expect(rewardConfigurationVersions.reserveDays.notNull).toBe(true);
    expect(rewardConfigurationVersions.fanValueWeights.notNull).toBe(true);
    expect(payoutHoldStatusEnum.enumValues).toEqual([
      "active",
      "released",
      "rejected",
      "expired",
    ]);
  });
});
