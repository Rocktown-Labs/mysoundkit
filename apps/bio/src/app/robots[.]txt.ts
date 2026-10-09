/* eslint-disable one-var */

import { createFileRoute } from "@tanstack/react-router";

// The $username route would otherwise swallow /robots.txt and serve a
// profile page to crawlers.
const robotsText = `User-agent: *
Allow: /
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(robotsText, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
          },
        }),
    },
  },
});
