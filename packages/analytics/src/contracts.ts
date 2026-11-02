/* eslint-disable one-var, sort-vars */
export type AnalyticsSurface = "bio" | "web";
export type AnalyticsProperties = Record<string, string | number | boolean>;

export const analyticsSites = {
  bio: { domain: "soundkit.bio", key: "pb_live_bi7j9kw1gfy9ob8x690iw79d" },
  web: { domain: "mysoundkit.com", key: "pb_live_e8d5aowqd1aplxgnwqgm7r79" },
} as const;

// Event names and property values are code-owned. Arbitrary scalar strings
// are not a privacy policy: a scalar can still contain a name or signed URL.
const propertyEnums: Record<string, readonly string[]> = {
    account_type: ["artist", "fan"],
    action: ["follow", "tip", "login", "signup"],
    destination: [
      "soundkit",
      "bio",
      "spotify",
      "apple_music",
      "youtube",
      "instagram",
      "other",
    ],
    duration_tier: ["preview", "full"],
    eligibility: ["eligible", "ineligible", "unknown"],
    kind: [
      "track",
      "project",
      "video",
      "merch",
      "physical",
      "tip",
      "subscription",
    ],
    media_type: ["audio", "video"],
    method: ["email", "google", "native", "clipboard"],
    outcome: ["success", "failed", "cancelled", "empty", "local", "expanded"],
    placement: [
      "header",
      "hero",
      "featured",
      "section",
      "footer",
      "player",
      "dashboard",
    ],
    product_type: [
      "track",
      "project",
      "merch",
      "physical",
      "subscription",
      "tip",
    ],
    provider: ["soundkit", "youtube", "mux"],
    purchase_mode: [
      "digital",
      "physical",
      "download",
      "license",
      "exclusive",
      "non_exclusive",
    ],
    reason: [
      "network",
      "unavailable",
      "popup_blocked",
      "cancelled",
      "session_invalid",
      "validation",
      "permission",
      "provider",
      "route_change",
      "other",
    ],
    scope: ["global", "north-america"],
    section: [
      "music",
      "projects",
      "videos",
      "merch",
      "events",
      "links",
      "support",
      "profile",
      "plan",
      "preferences",
      "feed",
      "credits",
    ],
    source: [
      "catalog",
      "search",
      "profile",
      "artist_profile",
      "playlist",
      "explore",
      "explore_rail",
      "video",
      "bio",
      "landing_hero",
      "nav",
      "explore_empty",
      "queue",
    ],
    step: [
      "profile",
      "identity",
      "genres",
      "location",
      "preferences",
      "plan",
      "eligibility",
      "connect",
      "complete",
    ],
  },
  booleanProperties = new Set([
    "has_referral",
    "has_region",
    "is_exclusive",
    "is_shuffle",
  ]),
  numericProperties = new Set([
    "item_count",
    "quantity",
    "step_number",
    "successful_count",
    "failed_count",
  ]);

export const eventCatalog = {
  account_created: ["account_type", "method", "source"],
  artist_followed: ["source"],
  artist_profile_saved: ["account_type"],
  bio_auth_handoff_completed: ["action"],
  bio_auth_handoff_failed: ["action", "reason"],
  bio_auth_handoff_started: ["action"],
  bio_cta_clicked: ["action", "kind", "placement"],
  bio_profile_viewed: [],
  bio_section_viewed: ["section"],
  cart_cleared: ["item_count"],
  cart_item_added: ["kind", "product_type", "purchase_mode", "quantity"],
  cart_item_removed: ["kind", "product_type", "purchase_mode", "quantity"],
  checkout_completed: ["kind"],
  checkout_started: ["kind"],
  creator_eligibility_declared: ["eligibility", "account_type"],
  file_downloaded: ["kind", "destination"],
  login_method_selected: ["method"],
  media_transition_completed: ["media_type", "provider"],
  onboarding_completed: ["account_type"],
  onboarding_exited: ["account_type", "step", "step_number"],
  onboarding_resumed: ["account_type", "step", "step_number"],
  onboarding_started: ["account_type"],
  onboarding_step_completed: ["account_type", "step", "step_number"],
  onboarding_step_viewed: ["account_type", "step", "step_number"],
  outbound_link_clicked: ["destination", "placement"],
  pip_entered: ["media_type", "provider"],
  playback_failed: ["media_type", "provider", "reason"],
  premium_access_confirmed: ["account_type"],
  premium_checkout_completed: ["account_type"],
  premium_checkout_started: ["account_type"],
  project_created: ["outcome"],
  project_updated: ["outcome"],
  queue_item_added: ["media_type"],
  region_fallback_served: ["scope", "has_region", "outcome"],
  region_selected: ["scope", "has_region"],
  search_results_viewed: ["outcome", "kind"],
  share_action_completed: ["method", "source"],
  signup_method_selected: ["method", "account_type", "source"],
  signup_type_selected: ["account_type"],
  stripe_connect_started: [],
  track_play_completed: ["source", "duration_tier"],
  track_play_started: ["source", "duration_tier"],
  track_saved: ["source"],
  track_upload_completed: ["kind", "outcome"],
  track_upload_settled: ["kind", "outcome", "successful_count", "failed_count"],
  user_signed_in: ["method"],
  video_play_completed: ["provider"],
  video_play_started: ["provider"],
} as const;

export type AnalyticsEventName = keyof typeof eventCatalog;

export function isAnalyticsEvent(event: string): event is AnalyticsEventName {
  return Object.hasOwn(eventCatalog, event);
}

export function sanitizeAnalyticsProperties(
  event: AnalyticsEventName,
  input: Record<string, unknown> = {}
): AnalyticsProperties {
  const output: AnalyticsProperties = {};
  for (const key of eventCatalog[event]) {
    const value = input[key];
    if (typeof value === "string" && propertyEnums[key]?.includes(value)) {
      output[key] = value;
    } else if (booleanProperties.has(key) && typeof value === "boolean") {
      output[key] = value;
    } else if (
      numericProperties.has(key) &&
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 100_000
    ) {
      output[key] = value;
    }
  }
  return output;
}

const staticRoutes = new Set([
    "/",
    "/login",
    "/signup",
    "/signup/artist",
    "/signup/fan",
    "/signup/artist/credentials",
    "/signup/fan/credentials",
    "/signup/artist/onboarding",
    "/signup/fan/onboarding",
    "/forgot-password",
    "/reset-password",
    "/auth/handoff",
    "/tracks",
    "/artist",
    "/artists",
    "/videos",
    "/projects",
    "/search",
    "/battles",
    "/live",
    "/listening-parties",
    "/challenges",
    "/open-verses",
    "/cart",
    "/checkout",
    "/pricing",
    "/premium",
    "/dashboard",
    "/dashboard/analytics",
    "/dashboard/payments",
    "/dashboard/finances",
    "/dashboard/tracks",
    "/dashboard/projects",
    "/dashboard/videos",
    "/dashboard/settings",
    "/dashboard/bio",
    "/dashboard/profile",
    "/dashboard/live",
    "/dashboard/messages",
  ]),
  dynamicRoutes = [
    ["/dashboard/tracks/", "/dashboard/tracks/:track"],
    ["/dashboard/projects/", "/dashboard/projects/:project"],
    ["/dashboard/videos/", "/dashboard/videos/:video"],
    ["/tracks/", "/tracks/:track"],
    ["/projects/", "/projects/:project"],
    ["/videos/", "/videos/:video"],
    ["/artist/", "/artist/:artist"],
    ["/artists/", "/artist/:artist"],
    ["/live/", "/live/:room"],
    ["/battles/", "/battles/:battle"],
    ["/listening-parties/", "/listening-parties/:party"],
    ["/open-verses/", "/open-verses/:challenge"],
  ] as const;

export function analyticsRoute(
  pathname: string,
  surface: AnalyticsSurface
): string {
  const path = pathname.split(/[?#]/u)[0]?.replace(/\/+$/u, "") || "/";
  if (staticRoutes.has(path)) {
    return path;
  }
  for (const [prefix, template] of dynamicRoutes) {
    if (path.startsWith(prefix)) {
      return template;
    }
  }
  if (surface === "bio" && /^\/[^/]+$/u.test(path)) {
    return "/artist";
  }
  return path.startsWith("/dashboard/") ? "/dashboard/other" : "/other";
}

export function analyticsDestination(url: URL): string {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "mysoundkit.com" || hostname === "www.mysoundkit.com") {
    return "soundkit";
  }
  if (hostname === "soundkit.bio" || hostname === "www.soundkit.bio") {
    return "bio";
  }
  if (hostname === "open.spotify.com") {
    return "spotify";
  }
  if (hostname === "music.apple.com") {
    return "apple_music";
  }
  if (["youtube.com", "www.youtube.com", "youtu.be"].includes(hostname)) {
    return "youtube";
  }
  if (["instagram.com", "www.instagram.com"].includes(hostname)) {
    return "instagram";
  }
  return "other";
}

export function analyticsValue(
  event: AnalyticsEventName,
  value: unknown
): number | undefined {
  if (
    event !== "checkout_completed" &&
    event !== "premium_checkout_completed"
  ) {
    return undefined;
  }
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000
    ? value
    : undefined;
}
