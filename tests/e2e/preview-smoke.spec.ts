import { expect, test } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_URL ?? process.env.SOUNDKIT_E2E_API_URL;

const publicRoutes = [
  { heading: /discover music/i, path: "/" },
  { heading: /live on soundkit/i, path: "/live" },
  { heading: /music videos/i, path: "/videos" },
] as const;

test("deployed preview serves healthy API and public browser routes", async ({
  page,
  request,
}) => {
  if (!apiBaseUrl) {
    throw new Error(
      "PLAYWRIGHT_API_URL or SOUNDKIT_E2E_API_URL is required for preview smoke tests."
    );
  }

  const healthResponse = await request.get(`${apiBaseUrl}/health`);
  expect(healthResponse.ok()).toBe(true);
  const healthBody = (await healthResponse.json()) as { ok?: boolean };
  expect(healthBody.ok).toBe(true);

  for (const route of publicRoutes) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/SoundKit/);
    await expect(
      page.getByRole("heading", { name: route.heading }).first()
    ).toBeVisible();
  }
});
