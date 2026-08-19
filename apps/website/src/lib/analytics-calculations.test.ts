import { describe, expect, it } from "vitest";

import {
  computePayoutState,
  computeReturningRate,
  filterSafeLocations,
  isQualifiedStream,
  isVerifiedPlay,
  MIN_LOCATION_LISTENERS,
  MIN_PAYOUT_THRESHOLD_CENTS,
} from "./analytics-calculations";

describe("Artist Analytics & Monetization Rules", () => {
  describe("Play Counting (30-second rule)", () => {
    it("does not count playback under 30 seconds as a Play", () => {
      expect(isVerifiedPlay(0, 180)).toBe(false);
      expect(isVerifiedPlay(10, 180)).toBe(false);
      expect(isVerifiedPlay(29, 180)).toBe(false);
    });

    it("counts playback >= 30 seconds as a verified Play", () => {
      expect(isVerifiedPlay(30, 180)).toBe(true);
      expect(isVerifiedPlay(120, 180)).toBe(true);
      expect(isVerifiedPlay(180, 180)).toBe(true);
    });

    it("correctly handles short tracks (< 30s) using 95% completion threshold", () => {
      // 20-second track: 95% is 19s
      expect(isVerifiedPlay(10, 20)).toBe(false);
      expect(isVerifiedPlay(18, 20)).toBe(false);
      expect(isVerifiedPlay(19, 20)).toBe(true);
      expect(isVerifiedPlay(20, 20)).toBe(true);
    });
  });

  describe("Qualified Stream Monetization Rules", () => {
    it("requires Premium listener and >= 70% track playback", () => {
      // Free listener: never qualifies
      expect(
        isQualifiedStream({
          isOwner: false,
          isPremium: false,
          playedSeconds: 150,
          trackDurationSeconds: 180,
        })
      ).toBe(false);

      // Owner self-stream: never qualifies
      expect(
        isQualifiedStream({
          isOwner: true,
          isPremium: true,
          playedSeconds: 180,
          trackDurationSeconds: 180,
        })
      ).toBe(false);

      // Premium listener under 70% (126s of 180s): does not qualify
      expect(
        isQualifiedStream({
          isOwner: false,
          isPremium: true,
          playedSeconds: 100,
          trackDurationSeconds: 180,
        })
      ).toBe(false);

      // Premium listener at >= 70%: qualifies
      expect(
        isQualifiedStream({
          isOwner: false,
          isPremium: true,
          playedSeconds: 126,
          trackDurationSeconds: 180,
        })
      ).toBe(true);
    });
  });

  describe("Geography Privacy Guard", () => {
    it("returns hasEnoughData: false when total audience is below threshold (3)", () => {
      const raw = [
        { city: "Austin", countryCode: "US", listeners: 1, regionCode: "TX" },
        { city: "Dallas", countryCode: "US", listeners: 1, regionCode: "TX" },
      ],
       result = filterSafeLocations(raw, MIN_LOCATION_LISTENERS);
      expect(result.hasEnoughData).toBe(false);
      expect(result.locations).toHaveLength(0);
      expect(result.totalListeners).toBe(2);
    });

    it("aggregates small cohorts (< 3) into 'Other Regions' when overall audience is sufficient", () => {
      const raw = [
        {
          city: "New York",
          countryCode: "US",
          listeners: 10,
          regionCode: "NY",
        },
        {
          city: "Los Angeles",
          countryCode: "US",
          listeners: 5,
          regionCode: "CA",
        },
        {
          city: "Bentonville",
          countryCode: "US",
          listeners: 1,
          regionCode: "AR",
        },
        {
          city: "Little Rock",
          countryCode: "US",
          listeners: 1,
          regionCode: "AR",
        },
      ],
       result = filterSafeLocations(raw, MIN_LOCATION_LISTENERS);
      expect(result.hasEnoughData).toBe(true);
      expect(result.totalListeners).toBe(17);

      // New York and LA should be exposed individually
      const ny = result.locations.find((l) => l.city === "New York"),
       la = result.locations.find((l) => l.city === "Los Angeles"),
       other = result.locations.find((l) => l.city === "Other Regions");

      expect(ny?.listeners).toBe(10);
      expect(la?.listeners).toBe(5);
      expect(other?.listeners).toBe(2); // 1 + 1 from AR
    });
  });

  describe("Payout Minimum & Balances ($25 Threshold)", () => {
    it("blocks payout eligibility when available balance < $25.00", () => {
      const state = computePayoutState(1842, MIN_PAYOUT_THRESHOLD_CENTS); // $18.42
      expect(state.isEligible).toBe(false);
      expect(state.progressPercent).toBe(74);
      expect(state.remainingCents).toBe(658);
    });

    it("allows payout when available balance reaches or exceeds $25.00", () => {
      const exact = computePayoutState(2500, MIN_PAYOUT_THRESHOLD_CENTS);
      expect(exact.isEligible).toBe(true);
      expect(exact.progressPercent).toBe(100);
      expect(exact.remainingCents).toBe(0);

      const excess = computePayoutState(3186, MIN_PAYOUT_THRESHOLD_CENTS); // $31.86
      expect(excess.isEligible).toBe(true);
      expect(excess.progressPercent).toBe(100);
    });
  });

  describe("Returning Listener Retention Rate", () => {
    it("returns 0% when there are 0 listeners", () => {
      expect(computeReturningRate(0, 0)).toBe(0);
    });

    it("calculates accurate percentage without fabrication", () => {
      expect(computeReturningRate(25, 100)).toBe(25);
      expect(computeReturningRate(1, 3)).toBe(33);
    });
  });
});
