/* eslint-disable one-var */

export interface NativeMenuItem {
  description: string;
  href: string;
  icon: string;
  label: string;
}

export interface NativeMenuSection {
  icon: string;
  items: readonly NativeMenuItem[];
  label: string;
}

export const EXPLORE_MENU_ITEMS = [
  {
    description: "Songs, charts, and regional track discovery",
    href: "/tracks",
    icon: "musical-notes-outline",
    label: "Songs",
  },
  {
    description: "Albums, EPs, mixtapes, and bundles",
    href: "/projects",
    icon: "albums-outline",
    label: "Projects",
  },
  {
    description: "Music videos and visual releases",
    href: "/videos",
    icon: "videocam-outline",
    label: "Videos",
  },
  {
    description: "Browse by sound, scene, and style",
    href: "/genres",
    icon: "pricetags-outline",
    label: "Genres",
  },
  {
    description: "Artist profiles and rising talent",
    href: "/artist",
    icon: "people-outline",
    label: "Artists",
  },
  {
    description: "Paid drops and fan purchases",
    href: "/shop",
    icon: "bag-handle-outline",
    label: "Shop",
  },
  {
    description: "Artist-led spaces, posts, and member chat",
    href: "/communities",
    icon: "chatbubbles-outline",
    label: "Communities",
  },
] as const satisfies readonly NativeMenuItem[];

export const LIBRARY_MENU_ITEMS = [
  {
    description: "Pick up where you left off",
    href: "/library/recent",
    icon: "play-circle-outline",
    label: "Recently Played",
  },
  {
    description: "Videos you have watched on SoundKit",
    href: "/library/watched",
    icon: "eye-outline",
    label: "Recently Watched",
  },
  {
    description: "Organize your favorite listening",
    href: "/library/playlists",
    icon: "list-outline",
    label: "Playlists",
  },
  {
    description: "Tracks you saved for later",
    href: "/library/saved",
    icon: "heart-outline",
    label: "Saved Tracks",
  },
  {
    description: "Music and releases you purchased",
    href: "/library/purchased",
    icon: "bag-check-outline",
    label: "Purchased",
  },
  {
    description: "Account, notifications, and listener settings",
    href: "/library/settings",
    icon: "settings-outline",
    label: "Account",
  },
] as const satisfies readonly NativeMenuItem[];

export const LIVE_MENU_ITEMS = [
  {
    description: "Live matchups and artist battles",
    href: "/live/battles",
    icon: "trophy-outline",
    label: "Battles",
  },
  {
    description: "Listen together with artists and fans",
    href: "/live/parties",
    icon: "people-circle-outline",
    label: "Parties",
  },
  {
    description: "Creator broadcasts happening now",
    href: "/live/streams",
    icon: "radio-outline",
    label: "Streams",
  },
] as const satisfies readonly NativeMenuItem[];

export const DASHBOARD_MENU_SECTIONS = [
  {
    icon: "musical-notes-outline",
    items: [
      {
        description: "Songs, masters, metadata, and files",
        href: "/dashboard/tracks",
        icon: "musical-notes-outline",
        label: "Tracks",
      },
      {
        description: "Albums, EPs, mixtapes, and bundles",
        href: "/dashboard/projects",
        icon: "albums-outline",
        label: "Projects",
      },
      {
        description: "Music videos and visual releases",
        href: "/dashboard/videos",
        icon: "videocam-outline",
        label: "Videos",
      },
      {
        description: "Open verse listings and submissions",
        href: "/dashboard/open-verses",
        icon: "mic-outline",
        label: "Open Verses",
      },
      {
        description: "Messages from artists, fans, and collaborators",
        href: "/dashboard/messages",
        icon: "chatbubble-ellipses-outline",
        label: "Messages",
      },
      {
        description: "Followers, friends, and artist relationships",
        href: "/dashboard/collaborators",
        icon: "person-add-outline",
        label: "Network",
      },
      {
        description: "Community posts, fan movement, and updates",
        href: "/dashboard/community",
        icon: "people-outline",
        label: "Community",
      },
    ],
    label: "My Music",
  },
  {
    icon: "bar-chart-outline",
    items: [
      {
        description: "Public profile, links, and artist presence",
        href: "/dashboard/career/profile",
        icon: "person-outline",
        label: "Profile",
      },
      {
        description: "Private account profile and identity",
        href: "/dashboard/profile",
        icon: "id-card-outline",
        label: "Account Profile",
      },
      {
        description: "Track, project, and audience performance",
        href: "/dashboard/career/analytics",
        icon: "bar-chart-outline",
        label: "Analytics",
      },
      {
        description: "Release dates, promo tasks, and planning",
        href: "/dashboard/career/calendar",
        icon: "calendar-outline",
        label: "Calendar",
      },
      {
        description: "Members, roles, and workspace access",
        href: "/dashboard/career/team",
        icon: "people-outline",
        label: "Workspace",
      },
      {
        description: "Campaigns, wallet, and audience targeting",
        href: "/dashboard/career/ads",
        icon: "megaphone-outline",
        label: "Ads",
      },
      {
        description: "Revenue, payouts, and financial snapshot",
        href: "/dashboard/career/payments",
        icon: "card-outline",
        label: "Finance",
      },
      {
        description: "Plan, subscription, and payment settings",
        href: "/library/settings",
        icon: "wallet-outline",
        label: "Billing",
      },
      {
        description: "Account, notifications, and artist settings",
        href: "/dashboard/career/settings",
        icon: "settings-outline",
        label: "Settings",
      },
    ],
    label: "My Career",
  },
  {
    icon: "trophy-outline",
    items: [
      {
        description: "Battle requests, discovery, challenges, and matchups",
        href: "/dashboard/live/battles",
        icon: "trophy-outline",
        label: "Battles",
      },
      {
        description: "Listening parties for releases and fans",
        href: "/dashboard/live/parties",
        icon: "people-circle-outline",
        label: "Parties",
      },
      {
        description: "Live stream setup and broadcast tools",
        href: "/dashboard/live/streams",
        icon: "radio-outline",
        label: "Streams",
      },
      {
        description: "Battle kits, format slots, and track picks",
        href: "/dashboard/live/my-kit",
        icon: "musical-notes-outline",
        label: "My Kits",
      },
      {
        description: "Battle performance by track",
        href: "/dashboard/live/my-stats",
        icon: "bar-chart-outline",
        label: "My Stats",
      },
    ],
    label: "Live",
  },
] as const satisfies readonly NativeMenuSection[];

export const DASHBOARD_CREATE_ITEMS = [
  {
    description: "Upload a song and its cover artwork",
    href: "/dashboard/tracks/new",
    icon: "musical-notes-outline",
    label: "New Track",
  },
  {
    description: "Create an album, EP, or mixtape",
    href: "/dashboard/projects/new",
    icon: "albums-outline",
    label: "New Project",
  },
  {
    description: "Publish a music video",
    href: "/dashboard/videos/new",
    icon: "videocam-outline",
    label: "New Video",
  },
  {
    description: "Start an open verse listing",
    href: "/dashboard/open-verses/new",
    icon: "mic-outline",
    label: "New Open Verse",
  },
] as const satisfies readonly NativeMenuItem[];
