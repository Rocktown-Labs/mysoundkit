/* eslint-disable one-var, sort-vars */

import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";

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
      { title: "SoundKit artist profiles" },
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
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}

export const bioCanonicalUrl = (username: string) =>
  `${SOUNDKIT_BIO_URL}/${encodeURIComponent(username)}`;
