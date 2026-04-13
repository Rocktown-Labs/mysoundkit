import { createFileRoute } from '@tanstack/react-router'

const llmsText = `# SoundKit

> SoundKit is a music streaming platform for discovering artists, streaming songs, joining listening parties, and tuning into live battles and artist-led streams.

## What SoundKit Does
- Streams music from emerging and established artists
- Helps fans discover tracks, genres, playlists, and artist profiles
- Supports social features around music, releases, and community interaction
- Hosts live experiences including battles, listening parties, and creator streams

## Core Pages
- Home: https://soundkit-web.rocktown-labs.workers.dev/
- Tracks: https://soundkit-web.rocktown-labs.workers.dev/tracks
- Artists: https://soundkit-web.rocktown-labs.workers.dev/artist
- Battles: https://soundkit-web.rocktown-labs.workers.dev/battles
- Genres: https://soundkit-web.rocktown-labs.workers.dev/genres

## Platform Summary
SoundKit combines music streaming, artist discovery, live events, and fan community features in one platform. Fans can explore new releases, save tracks, follow artists, and join live moments. Artists can publish tracks, grow their audience, and host experiences that go beyond passive listening.
`

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(llmsText, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })
      },
    },
  },
})
