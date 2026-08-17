import { PostHogProvider } from "@posthog/react";
import * as Sentry from "@sentry/tanstackstart-react";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/app-providers";
import {
  SITE_DESCRIPTION,
  SITE_ICON_URL,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  SOCIAL_IMAGE_URL,
} from "@/lib/site";

import appCss from "./globals.css?url";

export type RouterAppContext = Record<string, never>;

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const posthogProjectToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN,
    app = (
      <AppProviders>
        {children}
        <Scripts />
      </AppProviders>
    );

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans bg-background text-foreground antialiased">
        {posthogProjectToken ? (
          <PostHogProvider
            apiKey={posthogProjectToken}
            options={{
              api_host: "/ingest",
              capture_exceptions: true,
              debug: import.meta.env.DEV,
              defaults: "2025-05-24",
              ui_host:
                import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
                "https://us.posthog.com",
            }}
          >
            {app}
          </PostHogProvider>
        ) : (
          app
        )}
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
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

function GlobalErrorFallback({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg space-y-4">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Our team has been notified
          automatically.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              reset();
              void router.invalidate();
            }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 cursor-pointer"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/";
              }
            }}
            className="rounded-full border border-border px-5 py-2 text-sm font-medium transition hover:bg-muted cursor-pointer"
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  errorComponent: GlobalErrorFallback,
  head: () => ({
    links: [
      {
        href: `${SITE_URL}/`,
        rel: "canonical",
      },
      {
        href: "/favicon.ico",
        rel: "icon",
      },
      {
        href: "/soundkit-mark.svg",
        rel: "icon",
        type: "image/svg+xml",
      },
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
      {
        href: "/apple-touch-icon.png",
        rel: "apple-touch-icon",
      },
      {
        href: "/site.webmanifest",
        rel: "manifest",
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
      { content: SITE_NAME, name: "application-name" },
      { content: "#000000", name: "theme-color" },
      { content: "index,follow", name: "robots" },
      { content: SITE_NAME, property: "og:site_name" },
      { content: "website", property: "og:type" },
      { content: SITE_URL, property: "og:url" },
      { content: SITE_TITLE, property: "og:title" },
      { content: SITE_DESCRIPTION, property: "og:description" },
      { content: SOCIAL_IMAGE_URL, property: "og:image" },
      { content: "1200", property: "og:image:width" },
      { content: "630", property: "og:image:height" },
      { content: "summary_large_image", name: "twitter:card" },
      { content: "@soundkit", name: "twitter:site" },
      { content: SITE_TITLE, name: "twitter:title" },
      { content: SITE_DESCRIPTION, name: "twitter:description" },
      { content: SOCIAL_IMAGE_URL, name: "twitter:image" },
      {
        content: `${SITE_NAME} social preview artwork`,
        name: "twitter:image:alt",
      },
    ],
    scripts: [
      {
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          description: SITE_DESCRIPTION,
          name: SITE_NAME,
          url: SITE_URL,
        }),
        type: "application/ld+json",
      },
      {
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          logo: SITE_ICON_URL,
          name: SITE_NAME,
          url: SITE_URL,
        }),
        type: "application/ld+json",
      },
      {
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          applicationCategory: "MusicApplication",
          description: SITE_DESCRIPTION,
          name: SITE_NAME,
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          url: SITE_URL,
        }),
        type: "application/ld+json",
      },
    ],
  }),
  notFoundComponent: NotFoundComponent,
});
