import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const gotoWithViteRetry = async (page: Page, path: string) => {
  try {
    const response = await page.goto(path);
    if (response && response.status() >= 500) {
      await page.waitForTimeout(250);
      await page.goto(path);
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      (!error.message.includes("ERR_ABORTED") &&
        !error.message.includes("fetch failed"))
    ) {
      throw error;
    }

    await page.waitForTimeout(250);
    await page.goto(path);
  }
};

test.describe("main application surfaces", () => {
  test("fan can browse discovery, playback, pricing, and signup surfaces", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    await gotoWithViteRetry(page, "/");
    await expect(page.getByText("SoundKit").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Discover Music" })
    ).toBeVisible();
    await expect(
      page.getByText(/showing app-wide totals/iu).first()
    ).toBeVisible();

    await gotoWithViteRetry(page, "/tracks");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Top Songs" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /summer nights/i }).first()
    ).toBeVisible();

    await gotoWithViteRetry(page, "/pricing");
    await expect(page.getByText(/Premium|artist|fan/i).first()).toBeVisible();

    await gotoWithViteRetry(page, "/signup");
    await expect(
      page.getByRole("heading", { name: /join soundkit/i })
    ).toBeVisible();
    await expect(page.getByText("I'm a Fan")).toBeVisible();

    await page.getByRole("link", { name: /continue as artist/i }).click();
    await expect(
      page.getByRole("heading", { name: /create artist account/i })
    ).toBeVisible();

    await gotoWithViteRetry(page, "/signup");
    await page.getByRole("link", { name: /continue as fan/i }).click();
    await expect(
      page.getByRole("heading", { name: /create fan account/i })
    ).toBeVisible();

    await gotoWithViteRetry(page, "/signup/artist/credentials");
    await expect(
      page.getByRole("heading", { name: /create artist account/i })
    ).toBeVisible();
    await expect(page.getByText("I'm an Artist")).toBeHidden();
  });

  test("live surfaces render while realtime implementation is pending", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await gotoWithViteRetry(page, "/live");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/live battles/i).first()).toBeVisible();

    await gotoWithViteRetry(page, "/live/battles");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/battle/i).first()).toBeVisible();

    await gotoWithViteRetry(page, "/live/parties");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/part/i).first()).toBeVisible();
    await expect(
      page.getByText("No Metal listening parties are live yet.")
    ).toHaveCount(1);
  });

  test("videos route renders URL-backed filters without crashing", async ({
    page,
  }) => {
    await gotoWithViteRetry(
      page,
      "/videos?regionType=global&region=all&genre=hip-hop&sort=views-desc"
    );

    await expect(
      page.getByRole("heading", { name: "Music Videos" })
    ).toBeVisible();
    await expect(page.getByText("Featured Videos")).toBeVisible();
    await expect(page.getByText("Hip Hop").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  });

  test("creator live studio exposes stream setup and realtime controls", async ({
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

    await gotoWithViteRetry(page, "/dashboard/live/streams");

    await expect(
      page.getByRole("heading", { name: "Live Studio" })
    ).toBeVisible();
    await expect(
      page.getByText("Artists bring their kit, set a round order")
    ).toBeVisible();
    await expect(page.getByText("RealtimeKit layer")).toBeVisible();
    await expect(page.getByText("Realtime chat")).toBeVisible();
  });

  test("live room detail pages expose chat, lyrics, and battle voting", async ({
    page,
  }) => {
    await page.goto("/live/parties/single-album-party");
    await expect(
      page.getByRole("heading", { name: /single album spotlight/i })
    ).toBeVisible();
    await expect(page.getByText(/lyrics/i).first()).toBeVisible();
    await expect(page.getByText(/this room is synced/i)).toBeVisible();

    await gotoWithViteRetry(page, "/live/battles/battle-1");
    await expect(
      page.getByRole("heading", { name: /west coast showdown/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /vote dj nova/i })
    ).toBeVisible();
    await expect(page.getByText(/muted until turn/i)).toBeVisible();

    await page.goto("/live/streams/stream-1");
    await expect(
      page.getByRole("heading", {
        name: /beat making from the first drum hit/i,
      })
    ).toBeVisible();
    await expect(page.getByText(/cloudflare realtime ready/i)).toBeVisible();
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
    await expect(page.locator('img[src*="soundkit-mark.svg"]')).toHaveCount(0);
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
          selectedPlanCode: "artist_premium",
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

test.describe("administration", () => {
  test("admin can inspect platform metrics and users", async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        domain: "127.0.0.1",
        name: "soundkit_test_session",
        path: "/",
        value: "admin",
      },
    ]);

    await page.goto("/dashboard/admin");

    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.getByText("Gross revenue")).toBeVisible();
    await expect(page.getByText("$125.00")).toBeVisible();

    await page.getByRole("tab", { name: "Users" }).click();
    const usersTable = page.getByRole("table");
    await expect(usersTable.getByText("cg@rocktownlabs.com")).toBeVisible();
    await expect(usersTable.getByText("artist@example.com")).toBeVisible();
  });
});
