/* eslint-disable one-var */
export type NativeRouteOwner =
  | "dashboard-stack"
  | "discover-stack"
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
  icon:
    | "compass"
    | "microphone"
    | "musical-notes"
    | "people"
    | "radio"
    | "search";
  id: "artists" | "discover" | "live" | "music" | "search";
  screen: "(discover)" | "artists" | "live" | "music" | "search";
  title: string;
}

export const NATIVE_TAB_ROUTES = [
  {
    expoFile: "app/(drawer)/(tabs)/(discover)/index.tsx",
    href: "/",
    icon: "compass",
    id: "discover",
    screen: "(discover)",
    title: "Discover",
  },
  {
    expoFile: "app/(drawer)/(tabs)/music/index.tsx",
    href: "/music",
    icon: "musical-notes",
    id: "music",
    screen: "music",
    title: "Music",
  },
  {
    expoFile: "app/(drawer)/(tabs)/artists/index.tsx",
    href: "/artists",
    icon: "people",
    id: "artists",
    screen: "artists",
    title: "Artists",
  },
  {
    expoFile: "app/(drawer)/(tabs)/live/index.tsx",
    href: "/live",
    icon: "radio",
    id: "live",
    screen: "live",
    title: "Live",
  },
  {
    expoFile: "app/(drawer)/(tabs)/search/index.tsx",
    href: "/search",
    icon: "search",
    id: "search",
    screen: "search",
    title: "Search",
  },
] as const satisfies readonly NativeTabRoute[];

export const CANONICAL_ROUTES = [
  {
    id: "discover",
    nativeHref: "/",
    owner: "discover-stack",
    status: "native",
    webPath: "/",
  },
  {
    id: "music",
    nativeHref: "/music",
    owner: "discover-stack",
    status: "native",
    webPath: "/music",
  },
  {
    id: "search",
    nativeHref: "/search",
    owner: "discover-stack",
    status: "native",
    webPath: "/search",
  },
  {
    id: "tracks",
    nativeHref: "/tracks",
    owner: "discover-stack",
    status: "native",
    webPath: "/tracks",
  },
  {
    id: "track-detail",
    nativeHref: "/tracks/:id",
    owner: "discover-stack",
    status: "planned",
    webPath: "/tracks/$id",
  },
  {
    id: "projects",
    nativeHref: "/projects",
    owner: "discover-stack",
    status: "native",
    webPath: "/projects",
  },
  {
    id: "project-detail",
    nativeHref: "/projects/:id",
    owner: "discover-stack",
    status: "planned",
    webPath: "/projects/$id",
  },
  {
    id: "videos",
    nativeHref: "/videos",
    owner: "discover-stack",
    status: "native",
    webPath: "/videos",
  },
  {
    id: "video-detail",
    nativeHref: "/videos/:id",
    owner: "discover-stack",
    status: "planned",
    webPath: "/videos/$id",
  },
  {
    id: "artists",
    nativeHref: "/artists",
    owner: "discover-stack",
    status: "native",
    webPath: "/artist",
  },
  {
    id: "artist-detail",
    nativeHref: "/artists/:username",
    owner: "discover-stack",
    status: "planned",
    webPath: "/artist/$username",
  },
  {
    id: "communities",
    nativeHref: "/communities",
    owner: "discover-stack",
    status: "native",
    webPath: "/communities",
  },
  {
    id: "community-detail",
    nativeHref: "/communities/:communityId",
    owner: "discover-stack",
    status: "planned",
    webPath: "/communities/$communityId",
  },
  {
    id: "shop",
    nativeHref: "/shop",
    owner: "discover-stack",
    status: "native",
    webPath: "/shop",
  },
  {
    id: "genres",
    nativeHref: "/genres",
    owner: "discover-stack",
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
    nativeHref: "/dashboard/music/tracks",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/tracks",
  },
  {
    id: "dashboard-projects",
    nativeHref: "/dashboard/music/projects",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/projects",
  },
  {
    id: "dashboard-videos",
    nativeHref: "/dashboard/music/videos",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/videos",
  },
  {
    id: "dashboard-community",
    nativeHref: "/dashboard/music/community",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/community",
  },
  {
    id: "dashboard-messages",
    nativeHref: "/dashboard/music/messages",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/messages",
  },
  {
    id: "dashboard-open-verses",
    nativeHref: "/dashboard/music/open-verses",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/open-verses",
  },
  {
    id: "dashboard-network",
    nativeHref: "/dashboard/music/network",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/collaborators",
  },
  {
    id: "dashboard-account-profile",
    nativeHref: "/dashboard/career/account-profile",
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
    id: "login",
    nativeHref: "/login",
    owner: "root-stack",
    status: "native",
    webPath: "/login",
  },
  {
    id: "signup",
    nativeHref: "/signup",
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
    nativeHref: "/dashboard/music/tracks/new",
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
    nativeHref: "/dashboard/music/videos/new",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/videos/new",
  },
  {
    id: "new-project",
    nativeHref: "/dashboard/music/projects/new",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/projects/new",
  },
  {
    id: "new-open-verse",
    nativeHref: "/dashboard/music/open-verses/new",
    owner: "dashboard-stack",
    status: "native",
    webPath: "/dashboard/open-verses/new",
  },
] as const satisfies readonly CanonicalRoute[];
