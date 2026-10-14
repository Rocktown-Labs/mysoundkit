import { describe, expect, it } from "vitest";

import { clampWindowBounds, MIN_WINDOW_SIZE } from "./window-state";
import type { WindowBounds } from "./window-state";

const workArea: WindowBounds = { height: 1055, width: 1920, x: 0, y: 25 };

describe("clampWindowBounds", () => {
  it("applies defaults when no saved bounds exist", () => {
    expect(clampWindowBounds(undefined, workArea)).toEqual({
      height: 900,
      width: 1440,
      x: Math.round((1920 - 1440) / 2),
      y: Math.round(25 + (1055 - 900) / 2),
    });
  });

  it("keeps valid bounds that fit the work area", () => {
    expect(
      clampWindowBounds({ height: 800, width: 1280, x: 100, y: 100 }, workArea)
    ).toEqual({ height: 800, width: 1280, x: 100, y: 100 });
  });

  it("enforces the minimum window size", () => {
    const bounds = clampWindowBounds(
      { height: 100, width: 100, x: 0, y: 0 },
      workArea
    );

    expect(bounds.width).toBe(MIN_WINDOW_SIZE.width);
    expect(bounds.height).toBe(MIN_WINDOW_SIZE.height);
  });

  it("shrinks oversized windows to the work area", () => {
    const bounds = clampWindowBounds(
      { height: 4000, width: 4000, x: 0, y: 0 },
      workArea
    );

    expect(bounds).toEqual({ height: 1055, width: 1920, x: 0, y: 25 });
  });

  it("recovers windows saved on a disconnected monitor", () => {
    const bounds = clampWindowBounds(
      { height: 800, width: 1280, x: 5000, y: -2400 },
      workArea
    );

    expect(bounds.x).toBeLessThanOrEqual(1920 - MIN_WINDOW_SIZE.width);
    expect(bounds.y).toBe(25);
  });

  it("keeps the title bar reachable", () => {
    const bounds = clampWindowBounds(
      { height: 800, width: 1280, x: 0, y: 3000 },
      workArea
    );

    expect(bounds.y).toBe(25 + 1055 - 60);
  });

  it("ignores non-numeric or partial saved bounds", () => {
    const bounds = clampWindowBounds(
      {
        height: Number.POSITIVE_INFINITY,
        width: 1280,
        x: Number.NaN,
        y: "top" as unknown as number,
      },
      workArea
    );

    expect(Number.isFinite(bounds.x)).toBe(true);
    expect(Number.isFinite(bounds.y)).toBe(true);
    expect(bounds.height).toBe(900);
  });
});
