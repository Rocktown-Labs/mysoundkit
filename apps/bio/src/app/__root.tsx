/* eslint-disable one-var, sort-vars */

import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";

import { BioAudioPlayerProvider } from "@/components/bio-audio-player";
import { BioNav } from "@/components/bio-nav";
import { SOUNDKIT_BIO_URL } from "@/lib/api";

import appCss from "./styles.css?url";

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    links: [
      { href: appCss, rel: "stylesheet" },
      { href: "/favicon.svg", rel: "icon", type: "image/svg+xml" },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: "SoundKit.bio - Artist Profiles & Social Hub" },
      {
        content:
          "Discover independent artists, releases, and live support on SoundKit.",
        name: "description",
      },
      { content: "#101010", name: "theme-color" },
    ],
  }),
});

function RootComponent() {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary-foreground">
        <BioAudioPlayerProvider>
          <div className="flex min-h-screen flex-col pb-24">
            <BioNav />
            <main className="flex-1">
              <Outlet />
            </main>
          </div>
        </BioAudioPlayerProvider>
        <Scripts />
      </body>
    </html>
  );
}

export const bioCanonicalUrl = (username: string) =>
  `${SOUNDKIT_BIO_URL}/${encodeURIComponent(username)}`;
