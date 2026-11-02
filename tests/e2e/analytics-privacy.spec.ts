/* eslint-disable one-var, no-inline-comments */
import { expect, test } from "@playwright/test";

test("anonymous collector requests omit cookies, referrers and private route data", async ({
  page,
  context,
}) => {
  const requests: { headers: Record<string, string>; body: string }[] = [];
  await context.addCookies([
    {
      domain: "traks-collect.rocktown-labs.workers.dev",
      name: "unrelated_cookie",
      path: "/",
      sameSite: "None",
      secure: true,
      value: "private-cookie-value",
    },
  ]);
  await page.route(
    "https://traks-collect.rocktown-labs.workers.dev/api/event",
    async (route) => {
      requests.push({
        body: route.request().postData() ?? "",
        headers: await route.request().allHeaders(),
      });
      await route.fulfill({
        headers: { "Access-Control-Allow-Origin": "*" },
        status: 204,
      });
    }
  );
  await page.goto("/login?token=private-token");
  const modulePath = `/@fs/${process.cwd()}/packages/analytics/src/browser.ts`,
    storage = await page.evaluate(() => ({
      cookie: document.cookie,
      local: { ...localStorage },
      session: { ...sessionStorage },
    }));
  await page.evaluate(async (path) => {
    const { createTraksClient } = await import(/* @vite-ignore */ path),
      client = createTraksClient({
        hostname: "soundkit.bio",
        surface: "bio",
      });
    client.pageview("/private-person@example.test?token=private-token");
    client.capture("track_play_started", {
      source: "bio",
      url: "https://example.test/private",
      user_id: "private-user",
    });
  }, modulePath);
  await expect.poll(() => requests.length).toBe(2);
  for (const request of requests) {
    expect(request.headers.cookie).toBeUndefined();
    expect(request.headers.referer).toBeUndefined();
    expect(request.body).not.toContain("private");
    expect(JSON.parse(request.body).p).toBe("/artist");
  }
  expect(
    await page.evaluate(() => ({
      cookie: document.cookie,
      local: { ...localStorage },
      session: { ...sessionStorage },
    }))
  ).toEqual(storage);
});
