export interface WindowBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

/* oxlint-disable eslint/one-var, eslint/sort-vars -- declarator order follows data dependencies and export adjacency. */

export const DEFAULT_WINDOW_SIZE = { height: 900, width: 1440 } as const,
  /**
   * How much of the window title bar must stay reachable inside a display's
   * work area before saved bounds are considered off-screen.
   */
  MIN_VISIBLE_TITLE_HEIGHT = 60,
  MIN_WINDOW_SIZE = { height: 700, width: 1024 } as const;

const clampNumber = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), Math.max(min, max)),
  toFiniteNumber = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Clamps restored window bounds to a display work area.
 *
 * Saved bounds can come from an old machine layout, a disconnected monitor,
 * or a hand-edited state file, so nothing is trusted: sizes are enforced
 * against the minimum window size, and the position keeps at least the
 * title bar grabbable inside the work area.
 */
export const clampWindowBounds = (
  rawBounds: Partial<WindowBounds> | null | undefined,
  workArea: WindowBounds
): WindowBounds => {
  const width = clampNumber(
      toFiniteNumber(rawBounds?.width, DEFAULT_WINDOW_SIZE.width),
      Math.min(MIN_WINDOW_SIZE.width, workArea.width),
      workArea.width
    ),
    height = clampNumber(
      toFiniteNumber(rawBounds?.height, DEFAULT_WINDOW_SIZE.height),
      Math.min(MIN_WINDOW_SIZE.height, workArea.height),
      workArea.height
    ),
    defaultX = Math.round(workArea.x + (workArea.width - width) / 2),
    defaultY = Math.round(workArea.y + (workArea.height - height) / 2),
    maxX = Math.max(
      workArea.x,
      workArea.x + workArea.width - MIN_WINDOW_SIZE.width
    ),
    maxY = Math.max(
      workArea.y,
      workArea.y + workArea.height - MIN_VISIBLE_TITLE_HEIGHT
    );

  return {
    height: Math.round(height),
    width: Math.round(width),
    x: Math.round(
      clampNumber(toFiniteNumber(rawBounds?.x, defaultX), workArea.x, maxX)
    ),
    y: Math.round(
      clampNumber(toFiniteNumber(rawBounds?.y, defaultY), workArea.y, maxY)
    ),
  };
};
