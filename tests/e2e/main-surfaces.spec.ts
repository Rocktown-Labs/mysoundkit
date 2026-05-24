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

    await page.getByRole("link", { name: /continue as artist/i }).click();
    await expect(
      page.getByRole("heading", { name: /create artist account/i })
    ).toBeVisible();

    await page.goto("/signup");
    await page.getByRole("link", { name: /continue as fan/i }).click();
    await expect(
      page.getByRole("heading", { name: /create fan account/i })
    ).toBeVisible();

    await page.goto("/signup/artist/credentials");
    await expect(
      page.getByRole("heading", { name: /create artist account/i })
    ).toBeVisible();
    await expect(page.getByText("I'm an Artist")).toBeHidden();
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

  test("signup surfaces load without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: /join soundkit/i })
    ).toBeVisible();

    await page.getByRole("link", { name: /continue as artist/i }).click();
    await expect(
      page.getByRole("heading", { name: /create artist account/i })
    ).toBeVisible();

    await expect.poll(() => consoleErrors).toEqual([]);
  });

  test("desktop sidebar uses text branding when expanded", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Expanded sidebar branding is only visible on desktop."
    );

    await page.goto("/tracks");
    await expect(page.locator("[data-soundkit-sidebar-wordmark]")).toHaveText(
      "SoundKit"
    );
    await expect(page.locator('img[src*="soundkit-wordmark.svg"]')).toHaveCount(
      0
    );
  });
});

test.describe("signup onboarding guards", () => {
  test("authenticated incomplete artists resume onboarding from credentials", async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: "soundkit_test_session",
        path: "/",
        value: "incomplete",
      },
    ]);

    await page.goto("/signup/artist/credentials");

    await expect(page).toHaveURL(/\/signup\/artist\/onboarding$/);
    await expect(
      page.getByRole("heading", { name: /set up your artist profile/i })
    ).toBeVisible();
  });

  test("completed users skip signup and go to the dashboard guard target", async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await page.goto("/signup/artist/credentials");

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("artist onboarding restores the local draft after refresh", async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: "soundkit_test_session",
        path: "/",
        value: "incomplete",
      },
    ]);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "soundkit.artistOnboardingDraft.v1",
        JSON.stringify({
          city: "",
          locationQuery: "",
          primaryGenre: "",
          roles: ["musician"],
          selectedPlanCode: "artist_lite_ads",
          stateValue: "",
          step: 2,
          username: "codex_resume",
        })
      );
    });

    await page.goto("/signup/artist/onboarding");
    await expect(page.getByLabel("Username")).toHaveValue("codex_resume");
    await expect(page.getByText("Username is available.")).toBeVisible();
  });
});
