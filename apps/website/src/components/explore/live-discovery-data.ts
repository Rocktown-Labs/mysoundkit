import type { MusicGenre } from "@/lib/music-genres";

export interface PartyDiscoveryItem {
  albumCovers: string[];
  currentTrack: string;
  genre: MusicGenre["label"];
  hostName: string;
  id: string;
  isFeatured?: boolean;
  listenerCount: number;
  title: string;
}

export interface StreamDiscoveryItem {
  category: string;
  creatorAvatar: string;
  creatorName: string;
  genre: MusicGenre["label"];
  id: string;
  isFeatured?: boolean;
  thumbnailUrl: string;
  title: string;
  viewerCount: number;
}

export const partyDiscoveryItems: PartyDiscoveryItem[] = [
  {
    albumCovers: [
      "/summer-music-album-cover.png",
      "/night-music-album-cover.png",
    ],
    currentTrack: "Spotlight Album - Track 3",
    genre: "Hip-Hop/Rap",
    hostName: "SoundKit Curators",
    id: "single-album-party",
    isFeatured: true,
    listenerCount: 4210,
    title: "Single Album Spotlight",
  },
  {
    albumCovers: ["/hip-hop-album-cover.png", "/summer-music-album-cover.png"],
    currentTrack: "Album A Track 2 vs Album B Track 2",
    genre: "R&B/Soul",
    hostName: "A&R Live Room",
    id: "album-faceoff",
    isFeatured: true,
    listenerCount: 2890,
    title: "Alternating Album Faceoff",
  },
  {
    albumCovers: ["/night-music-album-cover.png", "/hip-hop-album-cover.png"],
    currentTrack: "Unreleased Track 5",
    genre: "Electronic",
    hostName: "Indie Discovery Club",
    id: "indie-discovery",
    listenerCount: 1630,
    title: "New Music Discovery Session",
  },
  {
    albumCovers: ["/summer-music-album-cover.png", "/hip-hop-album-cover.png"],
    currentTrack: "Crowd Favorite - Track 1",
    genre: "Pop",
    hostName: "Release Radar",
    id: "pop-release-radar",
    listenerCount: 1980,
    title: "Pop Release Radar",
  },
  {
    albumCovers: [
      "/night-music-album-cover.png",
      "/summer-music-album-cover.png",
    ],
    currentTrack: "Live poem over piano loop",
    genre: "Spoken Word",
    hostName: "Verse Room",
    id: "spoken-word-room",
    listenerCount: 730,
    title: "Spoken Word Listening Circle",
  },
];

export const streamDiscoveryItems: StreamDiscoveryItem[] = [
  {
    category: "Studio",
    creatorAvatar: "/diverse-user-avatars.png",
    creatorName: "Metro Boomin",
    genre: "Hip-Hop/Rap",
    id: "stream-studio",
    isFeatured: true,
    thumbnailUrl: "/music-battle-video-thumbnail.jpg",
    title: "Beat making from the first drum hit",
    viewerCount: 15_400,
  },
  {
    category: "Performance",
    creatorAvatar: "/diverse-user-avatars.png",
    creatorName: "Ariana",
    genre: "Pop",
    id: "stream-performance",
    isFeatured: true,
    thumbnailUrl: "/hip-hop-battle-stage.jpg",
    title: "Live vocal session and audience Q&A",
    viewerCount: 32_100,
  },
  {
    category: "Talkback",
    creatorAvatar: "/diverse-user-avatars.png",
    creatorName: "Mike Dean",
    genre: "R&B/Soul",
    id: "stream-breakdown",
    thumbnailUrl: "/rap-battle-crowd.jpg",
    title: "Mix review, playback, and live notes",
    viewerCount: 8500,
  },
  {
    category: "Production",
    creatorAvatar: "/diverse-user-avatars.png",
    creatorName: "Voltage Dreams",
    genre: "Electronic",
    id: "stream-electronic",
    thumbnailUrl: "/music-battle-video-thumbnail.jpg",
    title: "Synth patch design live",
    viewerCount: 6200,
  },
  {
    category: "Performance",
    creatorAvatar: "/diverse-user-avatars.png",
    creatorName: "Street Poet",
    genre: "Spoken Word",
    id: "stream-spoken-word",
    thumbnailUrl: "/rap-battle-crowd.jpg",
    title: "Poetry, cadence, and crowd prompts",
    viewerCount: 2100,
  },
];
