import { describe, expect, it } from "vitest";
import {
  computeGeographicData,
  computeReleaseSpikeData,
  computeRetentionMetrics,
  computeSourcesData,
  computeStreamTrends28d,
  computeStreamTrends7d,
} from "./analytics-calculations";

describe("Analytics Calculations", () => {
  describe("7-Day and 28-Day Stream Trends", () => {
    it("returns zeroed trends when totalPlays is 0", () => {
      const trends7d = computeStreamTrends7d(0);
      expect(trends7d).toHaveLength(7);
      for (const item of trends7d) {
        expect(item.streams).toBe(0);
        expect(item.mobile).toBe(0);
        expect(item.desktop).toBe(0);
      }

      const trends28d = computeStreamTrends28d(0);
      expect(trends28d).toHaveLength(4);
      for (const item of trends28d) {
        expect(item.streams).toBe(0);
        expect(item.mobile).toBe(0);
        expect(item.desktop).toBe(0);
      }
    });

    it("computes proportional stream distribution when totalPlays > 0", () => {
      const trends7d = computeStreamTrends7d(1000);
      expect(trends7d).toHaveLength(7);
      const totalStreams = trends7d.reduce((sum, item) => sum + item.streams, 0);
      expect(totalStreams).toBeGreaterThan(950);
      expect(totalStreams).toBeLessThan(1050);

      for (const item of trends7d) {
        expect(item.streams).toBe(item.mobile + item.desktop);
        expect(item.mobile).toBeGreaterThanOrEqual(item.desktop);
      }
    });
  });

  describe("Sources Breakdown", () => {
    it("returns zeroed sources when totalPlays is 0", () => {
      const sources = computeSourcesData(0);
      expect(sources).toHaveLength(7);
      for (const item of sources) {
        expect(item.direct).toBe(0);
        expect(item.algorithmic).toBe(0);
        expect(item.playlists).toBe(0);
      }
    });

    it("computes direct, algorithmic, and playlist streams proportionally", () => {
      const sources = computeSourcesData(500);
      expect(sources).toHaveLength(7);
      for (const item of sources) {
        expect(item.direct).toBeGreaterThanOrEqual(0);
        expect(item.algorithmic).toBeGreaterThanOrEqual(0);
        expect(item.playlists).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Geographic Data", () => {
    it("returns zeroed regions when totalPlays is 0", () => {
      const geo = computeGeographicData(0);
      expect(geo).toHaveLength(5);
      for (const item of geo) {
        expect(item.plays).toBe(0);
      }
    });

    it("distributes plays across target regions when totalPlays > 0", () => {
      const geo = computeGeographicData(1000);
      expect(geo).toHaveLength(5);
      const totalGeoPlays = geo.reduce((sum, item) => sum + item.plays, 0);
      expect(totalGeoPlays).toBeGreaterThan(950);
      expect(totalGeoPlays).toBeLessThan(1050);
      expect(geo[0]?.region).toContain("Arkansas");
    });
  });

  describe("Retention Metrics", () => {
    it("returns 0% across all retention milestones when totalPlays is 0", () => {
      const retention = computeRetentionMetrics(0);
      expect(retention.milestone).toBe(0);
      expect(retention.milestoneLabel).toBe("0%");
      expect(retention.full).toBe(0);
      expect(retention.fullLabel).toBe("0%");
      expect(retention.skip).toBe(0);
      expect(retention.skipLabel).toBe("0%");
    });

    it("returns qualified milestone rates when totalPlays > 0", () => {
      const retention = computeRetentionMetrics(500);
      expect(retention.milestone).toBe(84.6);
      expect(retention.milestoneLabel).toBe("84.6%");
      expect(retention.full).toBe(72.1);
      expect(retention.skip).toBe(15.4);
    });
  });
});
