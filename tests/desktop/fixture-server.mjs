import { once } from "node:events";
import http from "node:http";

/**
 * Minimal local stand-in for the SoundKit web app so the desktop shell's
 * Playwright suite runs offline: it exercises navigation policy, popup
 * denial, and the offline error page without depending on the production
 * site. "External" targets use unreachable localhost ports so nothing ever
 * leaves the machine.
 */
/* oxlint-disable eslint/one-var, eslint/sort-vars -- declarator order follows data dependencies and export adjacency. */

const FIXTURE_PAGE = `<!doctype html>
<html lang="en">
  <body>
    <h1 id="fixture-marker">SoundKit fixture</h1>
    <a id="external-popup" href="http://localhost:1/external" target="_blank" rel="noopener">
      External popup
    </a>
    <button id="navigate-external" type="button">Navigate away</button>
    <script>
      document
        .getElementById("navigate-external")
        .addEventListener("click", () => {
          window.location.href = "http://localhost:1/blocked";
        });
    </script>
  </body>
</html>`;

export const startFixtureServer = async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(FIXTURE_PAGE);
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = server.address();

  return {
    close: async () => {
      server.close();
      await once(server, "close");
    },
    url: `http://127.0.0.1:${port}`,
  };
};
