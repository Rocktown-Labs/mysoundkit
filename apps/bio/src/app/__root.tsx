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
      { href: `${SOUNDKIT_BIO_URL}/`, rel: "canonical" },
      { href: "/favicon.ico", rel: "icon" },
      { href: "/soundkit-mark.svg", rel: "icon", type: "image/svg+xml" },
      {
        href: "/favicon-32x32.png",
        rel: "icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        href: "/favicon-16x16.png",
        rel: "icon",
        sizes: "16x16",
        type: "image/png",
      },
      { href: "/apple-touch-icon.png", rel: "apple-touch-icon" },
      { href: "/site.webmanifest", rel: "manifest" },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: "SoundKit Bio — The Link-in-Bio for Music Creators" },
      {
        content:
          "The official link-in-bio for SoundKit artists. Stream releases, explore artists by region, and support creator careers.",
        name: "description",
      },
      { content: `${SOUNDKIT_BIO_URL}/`, property: "og:url" },
      { content: "website", property: "og:type" },
      {
        content: "SoundKit Bio — The Link-in-Bio for Music Creators",
        property: "og:title",
      },
      {
        content:
          "The official link-in-bio for SoundKit artists. Stream releases, explore artists by region, and support creator careers.",
        property: "og:description",
      },
      { content: "SoundKit Bio", property: "og:site_name" },
      {
        content: `${SOUNDKIT_BIO_URL}/soundkit-social-card.png`,
        property: "og:image",
      },
      { content: "summary_large_image", name: "twitter:card" },
      {
        content: `${SOUNDKIT_BIO_URL}/soundkit-social-card.png`,
        name: "twitter:image",
      },
      { content: "#0e0e10", name: "theme-color" },
    ],
  }),
});

function RootComponent() {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen overflow-x-clip bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary-foreground">
        <BioAudioPlayerProvider>
          <div className="flex min-h-screen flex-col pb-24">
            <BioNav />
            <main className="min-w-0 flex-1">
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
