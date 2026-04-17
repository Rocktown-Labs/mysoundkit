import { createFileRoute } from "@tanstack/react-router";

const baseUrl = "https://soundkit-web.rocktown-labs.workers.dev";

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
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${baseUrl}${route}</loc>
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
