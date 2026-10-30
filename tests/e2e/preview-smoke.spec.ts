/* eslint-disable one-var, sort-vars */
import { expect, test } from "@playwright/test";

const apiBaseUrl =
    process.env.PLAYWRIGHT_API_URL ?? process.env.SOUNDKIT_E2E_API_URL,
  bioBaseUrl =
    process.env.PLAYWRIGHT_BIO_URL ?? process.env.SOUNDKIT_E2E_BIO_URL,
  publicRoutes = [
    { heading: /discover music/iu, path: "/" },
    { heading: /live on soundkit/iu, path: "/live" },
    { heading: /music videos/iu, path: "/videos" },
  ] as const;

const cors = (origin: string | undefined) => ({
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": origin ?? "*",
});

test("deployed preview serves healthy API and public browser routes", async ({
  page,
  request,
}) => {
  if (!(apiBaseUrl && bioBaseUrl)) {
    test.skip(
      true,
      "PLAYWRIGHT_API_URL and PLAYWRIGHT_BIO_URL are required for preview smoke tests."
    );
    return;
  }

  const healthResponse = await request.get(`${apiBaseUrl}/health`);
  expect(healthResponse.ok()).toBe(true);
  const healthBody = (await healthResponse.json()) as { ok?: boolean };
  expect(healthBody.ok).toBe(true);

  for (const route of publicRoutes) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/SoundKit/u);
    await expect(
      page.getByRole("heading", { name: route.heading }).first()
    ).toBeVisible();
  }

  const bioPage = await page.context().newPage();
  await bioPage.goto(bioBaseUrl, { waitUntil: "domcontentloaded" });
  await expect(bioPage).toHaveTitle(/SoundKit Bio/iu);
  await expect(
    bioPage.getByRole("link", { name: "Claim Your Artist Bio" })
  ).toBeVisible();

  await page.goto("/live/preview", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Live Experience Preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Artist A View" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Artist B View" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Fan View" })).toBeVisible();
  await page.getByRole("button", { name: "Voting Active" }).click();
  await expect(page.getByText(/Battle Simulation Controls/iu)).toBeVisible();
  await page.getByRole("button", { name: "Creator Stream" }).click();
  await page.getByRole("button", { name: "Reconnecting" }).click();
  await expect(page.getByText("RECONNECTING")).toBeVisible();
});

for (const accountType of ["artist", "fan"] as const) {
  test(`Bio ${accountType} Google handoff resumes onboarding with a bearer session`, async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    if (!(apiBaseUrl && bioBaseUrl)) {
      test.skip(true, "Deployed Bio and API URLs are required.");
      return;
    }
    const sessionToken = "mock-bio-google-session";
    let authenticated = false;
    await context.route(`${apiBaseUrl}/v1/auth/capabilities`, async (route) => {
      await route.fulfill({
        headers: cors(route.request().headers().origin),
        json: { google: true },
      });
    });
    await context.route(
      `${apiBaseUrl}/v1/auth/handoff-token`,
      async (route) => {
        const request = route.request();
        if (request.method() === "OPTIONS") {
          await route.fulfill({
            headers: cors(request.headers().origin),
            status: 204,
          });
          return;
        }
        expect(request.postDataJSON().targetOrigin).toBe(
          new URL(bioBaseUrl).origin
        );
        await route.fulfill({
          headers: cors(request.headers().origin),
          json: authenticated
            ? { token: sessionToken }
            : { message: "Signed out" },
          status: authenticated ? 200 : 401,
        });
      }
    );
    await context.route(`${apiBaseUrl}/auth/sign-in/social`, async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await route.fulfill({
          headers: cors(request.headers().origin),
          status: 204,
        });
        return;
      }
      const payload = request.postDataJSON();
      expect(payload.provider).toBe("google");
      const callback = new URL(payload.callbackURL, request.headers().origin);
      expect(callback.origin).toBe(request.headers().origin);
      expect(callback.pathname).toBe("/auth/handoff");
      expect(callback.searchParams.get("returnOrigin")).toBe(
        new URL(bioBaseUrl).origin
      );
      authenticated = true;
      await route.fulfill({
        headers: cors(request.headers().origin),
        json: { redirect: true, url: callback.href },
      });
    });
    await context.route(`${apiBaseUrl}/v1/me`, async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") {
        await route.fulfill({
          headers: cors(request.headers().origin),
          status: 204,
        });
        return;
      }
      if (!authenticated) {
        await route.fulfill({
          headers: cors(request.headers().origin),
          json: {},
          status: 401,
        });
        return;
      }
      expect(request.headers().authorization).toBe(`Bearer ${sessionToken}`);
      await route.fulfill({
        headers: cors(request.headers().origin),
        json: {
          user: {
            accountType,
            displayName: "Google Test",
            email: "google@example.test",
            id: "google_test",
            onboardingCompletedAt: null,
            username: "",
          },
        },
      });
    });
    await context.route(
      `${apiBaseUrl}/v1/onboarding/username-availability?**`,
      async (route) => {
        await route.fulfill({
          headers: cors(route.request().headers().origin),
          json: { available: true },
        });
      }
    );
    await context.route(
      `${apiBaseUrl}/v1/onboarding/${accountType}`,
      async (route) => {
        const request = route.request();
        if (request.method() === "OPTIONS") {
          await route.fulfill({
            headers: cors(request.headers().origin),
            status: 204,
          });
          return;
        }
        expect(request.headers().authorization).toBe(`Bearer ${sessionToken}`);
        await route.fulfill({
          headers: cors(request.headers().origin),
          json: {},
        });
      }
    );
    await page.goto(`${bioBaseUrl}/signup/${accountType}`, {
      waitUntil: "domcontentloaded",
    });
    const googleButton = page.getByRole("button", {
      name: "Continue with Google",
    });
    await expect(googleButton).toBeVisible();
    await expect(googleButton.locator("svg")).toBeVisible();
    const popupPromise = page.waitForEvent("popup");
    await googleButton.click();
    const popup = await popupPromise;
    await popup.getByRole("button", { name: "Continue with Google" }).click();
    await expect(
      page.getByText(
        accountType === "artist"
          ? "Your Role & Rights"
          : "Pick your handle & city",
        { exact: true }
      )
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("soundkit_bio_auth_token"))
      )
      .toBe(sessionToken);
    if (accountType === "fan") {
      await page.locator("#fan-username").fill("googlefan");
      await page.locator("#fan-city").fill("Little Rock");
      await page.locator("#fan-state").fill("AR");
      await expect(page.getByText("@googlefan is available!")).toBeVisible();
      await page.getByRole("button", { exact: true, name: "Continue" }).click();
      await page.getByRole("button", { exact: true, name: "Continue" }).click();
      const onboarding = page.waitForRequest(
        (request) =>
          request.url() === `${apiBaseUrl}/v1/onboarding/fan` &&
          request.method() === "POST"
      );
      await page.getByRole("button", { name: "Complete Signup" }).click();
      const request = await onboarding;
      expect(request.postDataJSON().username).toBe("googlefan");
      expect(request.headers().authorization).toBe(`Bearer ${sessionToken}`);
    }
  });
}
