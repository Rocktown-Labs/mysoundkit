import { expect, test } from "@playwright/test";

test.describe("main application surfaces", () => {
  test("fan can browse discovery, playback, pricing, and signup surfaces", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("SoundKit").first()).toBeVisible();

    await page.goto("/tracks");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Top Songs" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /summer nights/i }).first()
    ).toBeVisible();

    await page.goto("/pricing");
    await expect(page.getByText(/Premium|artist|fan/i).first()).toBeVisible();

    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: /join soundkit/i })
    ).toBeVisible();
    await expect(page.getByText("I'm a Fan")).toBeVisible();
  });

  test("live surfaces render while realtime implementation is pending", async ({
    page,
  }) => {
    await page.goto("/live");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/live battles/i).first()).toBeVisible();

    await page.goto("/live/battles");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/battle/i).first()).toBeVisible();

    await page.goto("/live/parties");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/part/i).first()).toBeVisible();
  });
});
