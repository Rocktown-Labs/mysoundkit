/* eslint-disable one-var */

import { createFileRoute } from "@tanstack/react-router";

import { SOUNDKIT_BIO_URL } from "@/lib/api";

const llmsText = `# SoundKit Bio

> The official link-in-bio for SoundKit creators. Every artist gets one shareable page for their releases, tracks, live battles, and tips.

## Pages
- [Home](${SOUNDKIT_BIO_URL}/)
- [Discover artists](${SOUNDKIT_BIO_URL}/artists)
- [Claim your artist bio](${SOUNDKIT_BIO_URL}/signup/artist)
- [Join as a fan](${SOUNDKIT_BIO_URL}/signup/fan)

## About
SoundKit Bio lives at \`${SOUNDKIT_BIO_URL}/{username}\` for every artist on
[mysoundkit.com](https://mysoundkit.com). Pages include playable tracks,
release highlights, live battle history, and social links.
`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(llmsText, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
          },
        }),
    },
  },
});
