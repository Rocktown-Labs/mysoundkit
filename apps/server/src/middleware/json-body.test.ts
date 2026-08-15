import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { jsonBodyMiddleware } from "./json-body";

const buildApp = () => {
  const app = new Hono();

  app.use("/v1/*", jsonBodyMiddleware);

  app.post("/v1/uploads/track-source", async (c) => {
    try {
      const body = await c.req.raw.json();

      return c.json({ body, ok: true });
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "unknown",
          ok: false,
        },
        400
      );
    }
  });

  return app;
};

describe("json body middleware", () => {
  it("leaves the request body stream readable for handlers using c.req.raw", async () => {
    const app = buildApp(),
     response = await app.request(
      "http://soundkit.test/v1/uploads/track-source",
      {
        body: JSON.stringify({
          files: [{ name: "master.wav", size: 100, type: "audio/wav" }],
          route: "track-source",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      body: {
        files: [{ name: "master.wav", size: 100, type: "audio/wav" }],
        route: "track-source",
      },
      ok: true,
    });
  });

  it("rejects malformed JSON before it reaches the handler", async () => {
    const app = buildApp(),
     response = await app.request(
      "http://soundkit.test/v1/uploads/track-source",
      {
        body: "{not json",
        headers: { "content-type": "application/json" },
        method: "POST",
      }
    );

    expect(response.status).toBe(400);
    const body = await response.json<{
      code: string;
      message: string;
    }>();

    expect(body.code).toBe("bad_request");
    expect(body.message).toContain("Invalid request payload");
  });
});
