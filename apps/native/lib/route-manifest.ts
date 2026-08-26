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
  title: string;
}

export const NATIVE_TAB_ROUTES = [
  {
    expoFile: "app/(drawer)/(tabs)/index.tsx",
    href: "/",
    icon: "compass",
    id: "explore",
    title: "Explore",
  },
  {
    expoFile: "app/(drawer)/(tabs)/library.tsx",
    href: "/library",
    icon: "music",
    id: "library",
    title: "Library",
  },
  {
    expoFile: "app/(drawer)/(tabs)/live.tsx",
    href: "/live",
    icon: "microphone",
    id: "live",
    title: "Live",
  },
  {
    expoFile: "app/(drawer)/(tabs)/dashboard.tsx",
    href: "/dashboard",
    icon: "th-large",
    id: "dashboard",
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
    status: "planned",
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
    status: "planned",
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
    status: "planned",
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
    status: "planned",
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
    status: "planned",
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
    status: "planned",
    webPath: "/shop",
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
    status: "planned",
    webPath: "/library/recent",
  },
  {
    id: "playlists",
    nativeHref: "/library/playlists",
    owner: "library-stack",
    status: "planned",
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
    status: "planned",
    webPath: "/library/purchased",
  },
  {
    id: "library-settings",
    nativeHref: "/library/settings",
    owner: "library-stack",
    status: "planned",
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
    status: "planned",
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
    status: "planned",
    webPath: "/live/parties",
  },
  {
    id: "streams",
    nativeHref: "/live/streams",
    owner: "live-stack",
    status: "planned",
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
    status: "planned",
    webPath: "/dashboard/tracks",
  },
  {
    id: "dashboard-projects",
    nativeHref: "/dashboard/projects",
    owner: "dashboard-stack",
    status: "planned",
    webPath: "/dashboard/projects",
  },
  {
    id: "dashboard-videos",
    nativeHref: "/dashboard/videos",
    owner: "dashboard-stack",
    status: "planned",
    webPath: "/dashboard/videos",
  },
  {
    id: "dashboard-community",
    nativeHref: "/dashboard/community",
    owner: "dashboard-stack",
    status: "planned",
    webPath: "/dashboard/community",
  },
  {
    id: "dashboard-messages",
    nativeHref: "/dashboard/messages",
    owner: "dashboard-stack",
    status: "planned",
    webPath: "/dashboard/messages",
  },
  {
    id: "dashboard-live",
    nativeHref: "/dashboard/live",
    owner: "dashboard-stack",
    status: "planned",
    webPath: "/dashboard/live",
  },
  {
    id: "dashboard-career",
    nativeHref: "/dashboard/career",
    owner: "dashboard-stack",
    status: "planned",
    webPath: "/dashboard/career/profile",
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
    nativeHref: null,
    owner: "web",
    status: "web-only",
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
    nativeHref: null,
    owner: "web",
    status: "web-only",
    webPath: "/dashboard/videos/new",
  },
] as const satisfies readonly CanonicalRoute[];
