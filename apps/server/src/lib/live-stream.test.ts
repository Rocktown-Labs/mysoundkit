import { describe, expect, it } from "vitest";

import {
  cloudflareStreamCustomerBaseUrl,
  normalizeCloudflareStreamStatus,
  resolveCloudflareStreamConnection,
  resolveCloudflareStreamInputStatus,
} from "./live-stream";

describe("Cloudflare Stream live input helpers", () => {
  it("accepts a configured customer hostname without duplicating its prefix", () => {
    expect(
      cloudflareStreamCustomerBaseUrl(
        "customer-hudltf1y6f56lqim.cloudflarestream.com"
      )
    ).toBe("https://customer-hudltf1y6f56lqim.cloudflarestream.com");
  });

  it("builds a customer hostname from a bare customer code", () => {
    expect(cloudflareStreamCustomerBaseUrl("hudltf1y6f56lqim")).toBe(
      "https://customer-hudltf1y6f56lqim.cloudflarestream.com"
    );
  });

  it("normalizes object-shaped Cloudflare statuses", () => {
    expect(normalizeCloudflareStreamStatus({ state: "reconnecting" })).toBe(
      "reconnecting"
    );
    expect(normalizeCloudflareStreamStatus({ state: "connected" })).toBe(
      "connected"
    );
    expect(normalizeCloudflareStreamStatus()).toBe("idle");
  });

  it("uses the public lifecycle endpoint as the source of truth for a live input", () => {
    expect(
      resolveCloudflareStreamConnection({
        experienceStatus: "scheduled",
        inputStatus: "idle",
        lifecycleLive: true,
      })
    ).toBe("connected");
  });

  it("does not end a scheduled room when its idle input has not started", () => {
    expect(
      resolveCloudflareStreamConnection({
        experienceStatus: "scheduled",
        inputStatus: "idle",
        lifecycleLive: false,
      })
    ).toBe("unknown");
  });

  it("recognizes reconnecting Cloudflare input states", () => {
    expect(
      resolveCloudflareStreamConnection({
        experienceStatus: "live",
        inputStatus: "reconnecting",
      })
    ).toBe("disconnected");
  });

  it("treats a stopped lifecycle as authoritative over a stale connected input", () => {
    expect(
      resolveCloudflareStreamConnection({
        experienceStatus: "live",
        inputStatus: "connected",
        lifecycleLive: false,
      })
    ).toBe("disconnected");
  });

  it("does not start a scheduled experience when its lifecycle is offline", () => {
    expect(
      resolveCloudflareStreamConnection({
        experienceStatus: "scheduled",
        inputStatus: "connected",
        lifecycleLive: false,
      })
    ).toBe("unknown");
  });

  it("does not resurrect an ended experience from a stale live lifecycle", () => {
    expect(
      resolveCloudflareStreamConnection({
        experienceStatus: "ended",
        inputStatus: "connected",
        lifecycleLive: true,
      })
    ).toBe("unknown");
  });

  it("reports ended experiences as disconnected even when Cloudflare is stale", () => {
    expect(
      resolveCloudflareStreamInputStatus({
        experienceStatus: "ended",
        fallbackStatus: "connected",
        ingestStatus: "connected",
      })
    ).toBe("disconnected");
  });
});
