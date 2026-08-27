/* eslint-disable one-var */
export type NativeRouteOwner =
  | "dashboard-stack"
  | "explore-stack"
  | "library-stack"
  | "live-stack"
  | "root-stack"
  | "web";

export type NativeRouteStatus = "native" | "planned" | "web-only";

export interface CanonicalRoute {
  id: string;
  nativeHref: null | string;
  owner: NativeRouteOwner;
  status: NativeRouteStatus;
  webPath: string;
}

export interface NativeTabRoute {
  expoFile: string;
  href: string;
  icon: "compass" | "microphone" | "music" | "th-large";
  id: "dashboard" | "explore" | "library" | "live";
  screen: "(explore)" | "dashboard" | "library" | "live";
  title: string;
}

export const NATIVE_TAB_ROUTES = [
  {
    expoFile: "app/(drawer)/(tabs)/(explore)/index.tsx",
    href: "/",
    icon: "compass",
    id: "explore",
    screen: "(explore)",
    title: "Explore",
  },
  {
    expoFile: "app/(drawer)/(tabs)/library/index.tsx",
    href: "/library",
    icon: "music",
    id: "library",
    screen: "library",
    title: "Library",
  },
  {
    expoFile: "app/(drawer)/(tabs)/live/index.tsx",
    href: "/live",
    icon: "microphone",
    id: "live",
    screen: "live",
    title: "Live",
  },
  {
    expoFile: "app/(drawer)/(tabs)/dashboard/index.tsx",
    href: "/dashboard",
    icon: "th-large",
    id: "dashboard",
    screen: "dashboard",
    title: "Dashboard",
  },
] as const satisfies readonly NativeTabRoute[];

export const CANONICAL_ROUTES = [
  {
    id: "explore",
    nativeHref: "/",
    owner: "explore-stack",
    status: "native",
    webPath: "/",
  },
  {
    id: "tracks",
    nativeHref: "/tracks",
    owner: "explore-stack",
    status: "native",
    webPath: "/tracks",
  },
  {
    id: "track-detail",
    nativeHref: "/tracks/:id",
    owner: "explore-stack",
    status: "planned",
    webPath: "/tracks/$id",
  },
  {
    id: "projects",
    nativeHref: "/projects",
    owner: "explore-stack",
    status: "native",
    webPath: "/projects",
  },
  {
    id: "project-detail",
    nativeHref: "/projects/:id",
    owner: "explore-stack",
    status: "planned",
    webPath: "/projects/$id",
  },
  {
    id: "videos",
    nativeHref: "/videos",
    owner: "explore-stack",
    status: "native",
    webPath: "/videos",
  },
  {
    id: "video-detail",
    nativeHref: "/videos/:id",
    owner: "explore-stack",
    status: "planned",
    webPath: "/videos/$id",
  },
  {
    id: "artists",
    nativeHref: "/artists",
    owner: "explore-stack",
    status: "native",
    webPath: "/artist",
  },
  {
    id: "artist-detail",
    nativeHref: "/artists/:username",
    owner: "explore-stack",
    status: "planned",
    webPath: "/artist/$username",
  },
  {
    id: "communities",
    nativeHref: "/communities",
    owner: "explore-stack",
    status: "native",
    webPath: "/communities",
  },
  {
    id: "community-detail",
    nativeHref: "/communities/:communityId",
    owner: "explore-stack",
    status: "planned",
    webPath: "/communities/$communityId",
  },
  {
    id: "shop",
    nativeHref: "/shop",
    owner: "explore-stack",
    status: "native",
    webPath: "/shop",
  },
  {
    id: "genres",
    nativeHref: "/genres",
    owner: "explore-stack",
    status: "native",
    webPath: "/genres",
  },
  {
    id: "library",
    nativeHref: "/library",
    owner: "library-stack",
    status: "native",
    webPath: "/library",
  },
  {
    id: "saved",
    nativeHref: "/library/saved",
    owner: "library-stack",
    status: "planned",
    webPath: "/library/saved",
  },
  {
    id: "recent",
    nativeHref: "/library/recent",
    owner: "library-stack",
    status: "native",
    webPath: "/library/recent",
  },
  {
    id: "watched",
    nativeHref: "/library/watched",
    owner: "library-stack",
    status: "native",
    webPath: "/library/watched",
  },
  {
    id: "playlists",
    nativeHref: "/library/playlists",
    owner: "library-stack",
    status: "native",
    webPath: "/library/playlists",
  },
  {
    id: "playlist-detail",
    nativeHref: "/library/playlists/:id",
    owner: "library-stack",
    status: "planned",
    webPath: "/library/playlists/$id",
  },
  {
    id: "purchases",
    nativeHref: "/library/purchased",
    owner: "library-stack",
    status: "native",
    webPath: "/library/purchased",
  },
  {
    id: "library-settings",
    nativeHref: "/library/settings",
    owner: "library-stack",
    status: "native",
    webPath: "/library/settings",
  },
  {
    id: "live",
    nativeHref: "/live",
    owner: "live-stack",
    status: "native",
    webPath: "/live",
  },
  {
    id: "battles",
    nativeHref: "/live/battles",
    owner: "live-stack",
    status: "native",
    webPath: "/live/battles",
  },
  {
    id: "battle-detail",
    nativeHref: "/live/battles/:id",
    owner: "live-stack",
    status: "planned",
    webPath: "/live/battles/$id",
  },
  {
    id: "parties",
    nativeHref: "/live/parties",
    owner: "live-stack",
    status: "native",
    webPath: "/live/parties",
  },
  {
    id: "streams",
    nativeHref: "/live/streams",
    owner: "live-stack",
    status: "native",
    webPath: "/live/streams",
  },
  {
    id: "dashboard",
    nativeHref: "/dashboard",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard",
  },
  {
    id: "dashboard-tracks",
    nativeHref: "/dashboard/tracks",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/tracks",
  },
  {
    id: "dashboard-projects",
    nativeHref: "/dashboard/projects",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/projects",
  },
  {
    id: "dashboard-videos",
    nativeHref: "/dashboard/videos",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/videos",
  },
  {
    id: "dashboard-community",
    nativeHref: "/dashboard/community",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/community",
  },
  {
    id: "dashboard-messages",
    nativeHref: "/dashboard/messages",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/messages",
  },
  {
    id: "dashboard-open-verses",
    nativeHref: "/dashboard/open-verses",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/open-verses",
  },
  {
    id: "dashboard-network",
    nativeHref: "/dashboard/collaborators",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/collaborators",
  },
  {
    id: "dashboard-account-profile",
    nativeHref: "/dashboard/profile",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/profile",
  },
  {
    id: "dashboard-live",
    nativeHref: "/dashboard/live",
    owner: "dashboard-stack",
    status: "planned",
    webPath: "/dashboard/live",
  },
  {
    id: "dashboard-live-battles",
    nativeHref: "/dashboard/live/battles",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/live/battles",
  },
  {
    id: "dashboard-live-parties",
    nativeHref: "/dashboard/live/parties",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/live/parties",
  },
  {
    id: "dashboard-live-streams",
    nativeHref: "/dashboard/live/streams",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/live/streams",
  },
  {
    id: "dashboard-live-my-kit",
    nativeHref: "/dashboard/live/my-kit",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/live/my-kit",
  },
  {
    id: "dashboard-live-my-stats",
    nativeHref: "/dashboard/live/my-stats",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/live/my-stats",
  },
  {
    id: "dashboard-career",
    nativeHref: "/dashboard/career/profile",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/career/profile",
  },
  {
    id: "dashboard-career-analytics",
    nativeHref: "/dashboard/career/analytics",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/career/analytics",
  },
  {
    id: "dashboard-career-calendar",
    nativeHref: "/dashboard/career/calendar",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/career/calendar",
  },
  {
    id: "dashboard-career-team",
    nativeHref: "/dashboard/career/team",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/career/team",
  },
  {
    id: "dashboard-career-ads",
    nativeHref: "/dashboard/career/ads",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/career/ads",
  },
  {
    id: "dashboard-career-payments",
    nativeHref: "/dashboard/career/payments",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/career/payments",
  },
  {
    id: "dashboard-career-settings",
    nativeHref: "/dashboard/career/settings",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/career/settings",
  },
  {
    id: "login",
    nativeHref: "/",
    owner: "root-stack",
    status: "native",
    webPath: "/login",
  },
  {
    id: "signup",
    nativeHref: "/",
    owner: "root-stack",
    status: "native",
    webPath: "/signup",
  },
  {
    id: "admin",
    nativeHref: null,
    owner: "web",
    status: "web-only",
    webPath: "/dashboard/admin",
  },
  {
    id: "pricing",
    nativeHref: null,
    owner: "web",
    status: "web-only",
    webPath: "/pricing",
  },
  {
    id: "creator-uploads",
    nativeHref: "/dashboard/tracks/new",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/tracks/new",
  },
  {
    id: "project-editor",
    nativeHref: null,
    owner: "web",
    status: "web-only",
    webPath: "/dashboard/projects/$id/edit",
  },
  {
    id: "video-upload",
    nativeHref: "/dashboard/videos/new",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/videos/new",
  },
  {
    id: "new-project",
    nativeHref: "/dashboard/projects/new",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/projects/new",
  },
  {
    id: "new-open-verse",
    nativeHref: "/dashboard/open-verses/new",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/open-verses/new",
  },
] as const satisfies readonly CanonicalRoute[];
