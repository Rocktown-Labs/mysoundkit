export interface MockVideo {
  description: string;
  duration: string;
  externalPlaybackUrl?: string | null;
  id: string;
  muxPlaybackId?: string | null;
  playbackPolicy: "premium_only_live" | "public";
  sourceProjectId?: string | null;
  sourceProvider: "external" | "mux";
  sourceTrackId?: string | null;
  status: "live" | "processing" | "ready";
  thumbnail: string;
  title: string;
  verifiedOnPlatform: boolean;
  videoKind:
    | "music_video"
    | "promo"
    | "teaser"
    | "battle_replay"
    | "live_recording";
  viewCount: string;
  creator: {
    name: string;
    slug: string;
  };
}

export const mockVideos: MockVideo[] = [
  {
    creator: {
      name: "Luna Eclipse",
      slug: "luna-eclipse",
    },
    description:
      "The official music video for Midnight Vibes, uploaded directly by Luna Eclipse to SoundKit.",
    duration: "03:48",
    externalPlaybackUrl: null,
    id: "midnight-vibes-official-video",
    muxPlaybackId: null,
    playbackPolicy: "public",
    sourceProjectId: "project_after_dark",
    sourceProvider: "mux",
    sourceTrackId: "track_midnight_vibes",
    status: "ready",
    thumbnail: "/night-music-album-cover.png",
    title: "Midnight Vibes Official Video",
    verifiedOnPlatform: true,
    videoKind: "music_video",
    viewCount: "284K",
  },
  {
    creator: {
      name: "DJ Nova",
      slug: "dj-nova",
    },
    description:
      "A polished replay from one of SoundKit's flagship live battles, available to every fan after the event wraps.",
    duration: "15:22",
    externalPlaybackUrl: null,
    id: "west-coast-showdown-replay",
    muxPlaybackId: null,
    playbackPolicy: "public",
    sourceProjectId: null,
    sourceProvider: "mux",
    sourceTrackId: null,
    status: "ready",
    thumbnail: "/hip-hop-battle-stage.jpg",
    title: "West Coast Showdown Replay",
    verifiedOnPlatform: true,
    videoKind: "battle_replay",
    viewCount: "1.8M",
  },
  {
    creator: {
      name: "Metro Boomin",
      slug: "metro-boomin",
    },
    description:
      "A premium creator stream recorded straight from SoundKit Live. Premium artists can broadcast in real time and fans can catch the replay here.",
    duration: "LIVE",
    externalPlaybackUrl: null,
    id: "making-a-beat-from-scratch",
    muxPlaybackId: null,
    playbackPolicy: "premium_only_live",
    sourceProjectId: null,
    sourceProvider: "mux",
    sourceTrackId: null,
    status: "live",
    thumbnail: "/music-battle-video-thumbnail.jpg",
    title: "Making a Beat From Scratch",
    verifiedOnPlatform: true,
    videoKind: "live_recording",
    viewCount: "14.6K",
  },
  {
    creator: {
      name: "Neon Pulse",
      slug: "neon-pulse",
    },
    description:
      "An externally hosted teaser connected to the upcoming After Dark release. It can be shown on SoundKit, but it is not an on-platform verified upload.",
    duration: "00:42",
    externalPlaybackUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    id: "after-dark-visualizer-teaser",
    muxPlaybackId: null,
    playbackPolicy: "public",
    sourceProjectId: "project_after_dark",
    sourceProvider: "external",
    sourceTrackId: "track_electric_dreams",
    status: "processing",
    thumbnail: "/summer-music-album-cover.png",
    title: "After Dark Visualizer Teaser",
    verifiedOnPlatform: false,
    videoKind: "teaser",
    viewCount: "32K",
  },
] as const;

export const getMockVideo = (videoId: string) =>
  mockVideos.find((video) => video.id === videoId) ?? mockVideos[0];
