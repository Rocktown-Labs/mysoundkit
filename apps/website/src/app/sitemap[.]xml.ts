import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/site";

const routes = [
  "/",
  "/tracks",
  "/artist",
  "/live",
  "/live/battles",
  "/live/parties",
  "/live/streams",
  "/genres",
  "/library",
  "/new-releases",
  "/login",
  "/signup",
],

 sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${SITE_URL}${route}</loc>
  </url>`
  )
  .join("\n")}
</urlset>`;

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(sitemap, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
          },
        }),
    },
  },
});
