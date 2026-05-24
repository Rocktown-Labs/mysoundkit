import { createServer } from "node:http";

const json = (response, status, body, origin) => {
  response.writeHead(status, {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type,cookie",
    "access-control-allow-origin": origin,
    "content-type": "application/json",
  });
  response.end(JSON.stringify(body));
};

const mockUser = (session) => {
  if (session === "complete") {
    return {
      accountType: "artist",
      displayName: "Complete Artist",
      id: "user_complete",
      onboardingCompletedAt: "2026-05-24T12:00:00.000Z",
      username: "complete_artist",
    };
  }

  if (session === "fan_incomplete") {
    return {
      accountType: "fan",
      displayName: "Fan",
      id: "user_fan",
      onboardingCompletedAt: null,
      username: "fan_test",
    };
  }

  if (session === "incomplete") {
    return {
      accountType: "artist",
      displayName: "Artist",
      id: "user_artist",
      onboardingCompletedAt: null,
      username: "artist_test",
    };
  }

  return null;
};

export const createMockApiServer = ({
  host = "127.0.0.1",
  port = 3000,
  webOrigin = "http://127.0.0.1:4311",
} = {}) => {
  const server = createServer((request, response) => {
    response.setHeader("access-control-allow-origin", webOrigin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("access-control-allow-headers", "content-type,cookie");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${host}:${port}`);

    if (url.pathname === "/v1/me" || url.pathname === "/v1/me/") {
      const session = request.headers.cookie
        ?.split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("soundkit_test_session="))
        ?.split("=")[1];
      const user = mockUser(session);

      if (!user) {
        json(
          response,
          401,
          { message: "Authentication is required." },
          webOrigin
        );
        return;
      }

      json(
        response,
        200,
        {
          activeWorkspace: null,
          entitlements: {
            activePlanCode: null,
            canCreateLiveBattles: false,
            canHostLiveStreams: false,
            canViewLiveBattles: false,
            canVoteLiveBattles: false,
            canWatchCreatorStreams: false,
            isPremium: false,
          },
          user,
          workspaces: [],
        },
        webOrigin
      );
      return;
    }

    if (url.pathname === "/v1/onboarding/username-availability") {
      const username = (url.searchParams.get("username") ?? "")
        .trim()
        .toLowerCase();
      const reserved = username === "soundkit";

      json(
        response,
        200,
        {
          available: !reserved,
          message: reserved
            ? "That username is reserved."
            : "Username is available.",
          reason: reserved ? "reserved" : "available",
          username,
        },
        webOrigin
      );
      return;
    }

    json(response, 404, { message: `Not Found - ${url.pathname}` }, webOrigin);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server);
    });
  });
};
