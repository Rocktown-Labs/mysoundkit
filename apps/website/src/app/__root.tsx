import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  Scripts,
  Link,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import {
  TanStackRouterDevtoolsPanel,
  TanStackRouterDevtools,
} from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import appCss from "./globals.css?url";

export interface RouterAppContext {}

const SITE_NAME = 'SoundKit'
const SITE_URL = 'https://soundkit-web.rocktown-labs.workers.dev'
const SITE_DESCRIPTION =
  'Stream music, discover artists, join listening parties, and tune into live battles and creator streams on SoundKit.'
const SITE_TITLE = 'SoundKit | Stream music and join live moments'
const SOCIAL_IMAGE_URL = `${SITE_URL}/soundkit-social-card.png`

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    links: [
      {
        href: `${SITE_URL}/`,
        rel: 'canonical',
      },
      {
        href: '/icon.svg',
        rel: 'icon',
        type: 'image/svg+xml',
      },
      {
        href: '/apple-icon.png',
        rel: 'apple-touch-icon',
      },
      {
        href: appCss,
        rel: "stylesheet",
      },
    ],
    meta: [
      { charSet: "utf-8" },
      {
        content: "width=device-width, initial-scale=1",
        name: "viewport",
      },
      { title: SITE_TITLE },
      {
        content: SITE_DESCRIPTION,
        name: "description",
      },
      { content: SITE_NAME, name: 'application-name' },
      { content: '#000000', name: 'theme-color' },
      { content: 'index,follow', name: 'robots' },
      { content: SITE_NAME, property: 'og:site_name' },
      { content: 'website', property: 'og:type' },
      { content: SITE_URL, property: 'og:url' },
      { content: SITE_TITLE, property: 'og:title' },
      { content: SITE_DESCRIPTION, property: 'og:description' },
      { content: SOCIAL_IMAGE_URL, property: 'og:image' },
      { content: '1200', property: 'og:image:width' },
      { content: '630', property: 'og:image:height' },
      { content: 'summary_large_image', name: 'twitter:card' },
      { content: '@soundkit', name: 'twitter:site' },
      { content: SITE_TITLE, name: 'twitter:title' },
      { content: SITE_DESCRIPTION, name: 'twitter:description' },
      { content: SOCIAL_IMAGE_URL, name: 'twitter:image' },
    ],
    scripts: [
      {
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_URL,
          description: SITE_DESCRIPTION,
        }),
        type: 'application/ld+json',
      },
      {
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          logo: SOCIAL_IMAGE_URL,
          name: SITE_NAME,
          url: SITE_URL,
        }),
        type: 'application/ld+json',
      },
      {
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          applicationCategory: 'MusicApplication',
          description: SITE_DESCRIPTION,
          name: SITE_NAME,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          url: SITE_URL,
        }),
        type: 'application/ld+json',
      },
    ],
  }),
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          {children}
          <Toaster />
          <TanStackRouterDevtools
            position="bottom-left"
            plugins={[
              {
                name: "TanStack Query",
                render: <ReactQueryDevtoolsPanel />,
              },
              {
                name: "TanStack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
          <Scripts />
        </ThemeProvider>
      </body>
    </html>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="font-notable text-sm uppercase tracking-[0.3em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-4 text-3xl font-bold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you requested does not exist or may have been moved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/"
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Go home
          </Link>
          <Link
            to="/tracks"
            className="rounded-full border border-border px-5 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Browse tracks
          </Link>
        </div>
      </div>
    </div>
  );
}
