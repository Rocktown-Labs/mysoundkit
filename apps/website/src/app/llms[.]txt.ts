import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/site";

const llmsText = `# SoundKit

> SoundKit is a music streaming platform for discovering artists, streaming songs, joining listening parties, and tuning into live battles and artist-led streams.

## What SoundKit Does
- Streams music from emerging and established artists
- Helps fans discover tracks, genres, playlists, and artist profiles
- Supports social features around music, releases, and community interaction
- Hosts live experiences including battles, listening parties, and creator streams

## Core Pages
- Home: ${SITE_URL}/
- Tracks: ${SITE_URL}/tracks
- Artists: ${SITE_URL}/artist
- Live: ${SITE_URL}/live
- Genres: ${SITE_URL}/genres

## Platform Summary
SoundKit combines music streaming, artist discovery, live events, and fan community features in one platform. Fans can explore new releases, save tracks, follow artists, and join live moments. Artists can publish tracks, grow their audience, and host experiences that go beyond passive listening.
`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(llmsText, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        }),
    },
  },
});
