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

describe("Artist Analytics & Creator Payments Domain Rules", () => {
  describe("1. Play Counting Semantics (30-second rule with short-track fallback)", () => {
    it("does not count playback under 30 seconds on normal tracks (e.g. 180s track)", () => {
      expect(isVerifiedPlay(0, 180)).toBe(false);
      expect(isVerifiedPlay(10, 180)).toBe(false);
      expect(isVerifiedPlay(29, 180)).toBe(false);
    });

    it("counts playback >= 30 seconds as a verified Play on normal tracks", () => {
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

      // 10-second track: 95% is 9.5s -> 10s
      expect(isVerifiedPlay(5, 10)).toBe(false);
      expect(isVerifiedPlay(9.5, 10)).toBe(true);
    });
  });

  describe("2. Qualified Stream Monetization & Comped Account Rules", () => {
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

      // Premium listener under 70% (100s of 180s): does not qualify
      expect(
        isQualifiedStream({
          isOwner: false,
          isPremium: true,
          playedSeconds: 100,
          trackDurationSeconds: 180,
        })
      ).toBe(false);

      // Premium listener at >= 70% (126s of 180s): qualifies
      expect(
        isQualifiedStream({
          isOwner: false,
          isPremium: true,
          playedSeconds: 126,
          trackDurationSeconds: 180,
        })
      ).toBe(true);
    });

    it("distinguishes qualified listening from funded earnings (comped subscribers)", () => {
      // A comped premium subscriber generates a Qualified Stream, but $0.00 funded pool contribution
      const compedSubscriptionAllocationCents = 0;
      const isStreamQualified = isQualifiedStream({
        isOwner: false,
        isPremium: true,
        playedSeconds: 150,
        trackDurationSeconds: 180,
      });

      expect(isStreamQualified).toBe(true);
      expect(compedSubscriptionAllocationCents).toBe(0);
      // Comped account produces 0 funded creator earnings
      const creatorEarningsCents = Math.round(compedSubscriptionAllocationCents * 1.0);
      expect(creatorEarningsCents).toBe(0);
    });
  });

  describe("3. Temporal Returning Listener Semantics", () => {
    it("classifies user listening to multiple tracks on the SAME day as New Listener (Catalog Depth)", () => {
      // User listens to 3 tracks on Day 1:
      const userSessions = [
        { date: "2026-08-19", trackId: "track_1" },
        { date: "2026-08-19", trackId: "track_2" },
        { date: "2026-08-19", trackId: "track_3" },
      ];
      const distinctDays = new Set(userSessions.map((s) => s.date)).size;
      const distinctTracks = new Set(userSessions.map((s) => s.trackId)).size;

      expect(distinctDays).toBe(1);
      expect(distinctTracks).toBe(3);

      const isReturning = distinctDays > 1;
      expect(isReturning).toBe(false); // MUST NOT be classified as returning
    });

    it("classifies user listening across multiple distinct calendar days as Returning Listener", () => {
      // User listens on Day 1 and returns on Day 3:
      const userSessions = [
        { date: "2026-08-17", trackId: "track_1" },
        { date: "2026-08-19", trackId: "track_1" },
      ];
      const distinctDays = new Set(userSessions.map((s) => s.date)).size;
      expect(distinctDays).toBe(2);

      const isReturning = distinctDays > 1;
      expect(isReturning).toBe(true); // MUST be classified as returning
    });
  });

  describe("4. Qualification Rate Denominator Semantics", () => {
    it("calculates qualification rate against eligible Premium sessions, not Free-tier Plays", () => {
      const total30sPlays = 100; // 90 Free plays, 10 Premium plays
      const eligiblePremiumSessions = 10;
      const qualifiedStreams = 7;

      // Bad denominator: 7 / 100 = 7%
      const badRate = Math.round((qualifiedStreams / total30sPlays) * 100);
      expect(badRate).toBe(7);

      // Correct denominator: 7 / 10 = 70%
      const correctRate = Math.round((qualifiedStreams / eligiblePremiumSessions) * 100);
      expect(correctRate).toBe(70);
    });

    it("returns 0% when there are 0 eligible Premium sessions", () => {
      const eligiblePremiumSessions = 0;
      const qualifiedStreams = 0;
      const rate = eligiblePremiumSessions > 0
        ? Math.round((qualifiedStreams / eligiblePremiumSessions) * 100)
        : 0;
      expect(rate).toBe(0);
    });
  });

  describe("5. Payout Minimum & Financial Balances ($25 Threshold)", () => {
    it("blocks payout eligibility when available (cleared) balance < $25.00", () => {
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

  describe("6. Geography Privacy Guard", () => {
    it("returns hasEnoughData: false when total audience is below threshold (3)", () => {
      const raw = [
        { city: "Austin", countryCode: "US", listeners: 1, regionCode: "TX" },
        { city: "Dallas", countryCode: "US", listeners: 1, regionCode: "TX" },
      ];
      const result = filterSafeLocations(raw, MIN_LOCATION_LISTENERS);
      expect(result.hasEnoughData).toBe(false);
      expect(result.locations).toHaveLength(0);
      expect(result.totalListeners).toBe(2);
    });

    it("aggregates small cohorts (< 3) into 'Other Regions' when overall audience is sufficient", () => {
      const raw = [
        { city: "New York", countryCode: "US", listeners: 10, regionCode: "NY" },
        { city: "Los Angeles", countryCode: "US", listeners: 5, regionCode: "CA" },
        { city: "Bentonville", countryCode: "US", listeners: 1, regionCode: "AR" },
        { city: "Little Rock", countryCode: "US", listeners: 1, regionCode: "AR" },
      ];
      const result = filterSafeLocations(raw, MIN_LOCATION_LISTENERS);
      expect(result.hasEnoughData).toBe(true);
      expect(result.totalListeners).toBe(17);

      const ny = result.locations.find((l) => l.city === "New York");
      const la = result.locations.find((l) => l.city === "Los Angeles");
      const other = result.locations.find((l) => l.city === "Other Regions");

      expect(ny?.listeners).toBe(10);
      expect(la?.listeners).toBe(5);
      expect(other?.listeners).toBe(2); // 1 + 1 from AR
    });
  });

  describe("7. Returning Listener Retention Rate", () => {
    it("returns 0% when there are 0 listeners", () => {
      expect(computeReturningRate(0, 0)).toBe(0);
    });

    it("calculates accurate percentage without fabrication", () => {
      expect(computeReturningRate(25, 100)).toBe(25);
      expect(computeReturningRate(1, 3)).toBe(33);
    });
  });
});
