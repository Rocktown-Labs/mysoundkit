import { expect, test } from "@playwright/test";

const apiBaseUrl =
    process.env.PLAYWRIGHT_API_URL ?? process.env.SOUNDKIT_E2E_API_URL,
  bioBaseUrl =
    process.env.PLAYWRIGHT_BIO_URL ?? process.env.SOUNDKIT_E2E_BIO_URL,
  publicRoutes = [
    { heading: /discover music/i, path: "/" },
    { heading: /live on soundkit/i, path: "/live" },
    { heading: /music videos/i, path: "/videos" },
  ] as const;

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
    await expect(page).toHaveTitle(/SoundKit/);
    await expect(
      page.getByRole("heading", { name: route.heading }).first()
    ).toBeVisible();
  }

  const bioPage = await page.context().newPage();
  await bioPage.goto(bioBaseUrl, { waitUntil: "domcontentloaded" });
  await expect(bioPage).toHaveTitle(/SoundKit Bio/i);
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
  await expect(page.getByText(/Battle Simulation Controls/i)).toBeVisible();
  await page.getByRole("button", { name: "Creator Stream" }).click();
  await page.getByRole("button", { name: "Reconnecting" }).click();
  await expect(page.getByText("RECONNECTING")).toBeVisible();
});
