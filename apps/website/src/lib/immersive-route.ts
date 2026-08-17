/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group */
/**
 * Route helpers for identifying immersive media experience routes.
 *
 * Immersive routes (desktop Twitch-style 3-column bounded layout):
 * - /live/streams/$id
 * - /live/parties/$id
 * - /live/battles/$id
 * - /videos/$id
 * - /videos/$regionSlug/$slug
 *
 * Non-immersive routes (standard page-level scrolling):
 * - /live
 * - /live/streams
 * - /live/parties
 * - /live/battles
 * - /videos
 * - /live/preview
 */

export function isLiveExperienceDetailRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "");

  if (normalized.startsWith("/live/preview")) {
    return false;
  }

  // Matches /live/streams/:id, /live/parties/:id, /live/battles/:id
  const liveDetailRegex = /^\/live\/(streams|parties|battles)\/[^/]+$/;
  return liveDetailRegex.test(normalized);
}

export function isVideoDetailRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, ""),
    // Matches /videos/:id or /videos/:regionSlug/:slug, but NOT /videos
    videoDetailRegex = /^\/videos\/[^/]+(?:\/[^/]+)?$/;
  return videoDetailRegex.test(normalized) && normalized !== "/videos";
}

export function isImmersiveExploreRoute(pathname: string): boolean {
  return isLiveExperienceDetailRoute(pathname) || isVideoDetailRoute(pathname);
}
