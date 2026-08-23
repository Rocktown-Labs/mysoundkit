/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const cookieDomain = (() => {
  const rawUrl =
    process.env.PLAYWRIGHT_BASE_URL ??
    process.env.SOUNDKIT_E2E_WEB_URL ??
    "http://127.0.0.1:4311";
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return "127.0.0.1";
  }
})();

const gotoWithViteRetry = async (page: Page, path: string) => {
  try {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    if (response && response.status() >= 500) {
      await page.waitForTimeout(250);
      await page.goto(path, { waitUntil: "domcontentloaded" });
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
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
};

test.describe("main application surfaces", () => {
  test("fan can browse discovery, playback, pricing, and signup surfaces", async ({
    page,
  }) => {
    test.setTimeout(75_000);

    await gotoWithViteRetry(page, "/");
    await expect(
      page.getByRole("heading", { name: "Discover Music" })
    ).toBeVisible();
    await expect(
      page.getByText(/showing app-wide totals/i).first()
    ).toBeVisible();
    await expect(page.getByTestId("explore-header")).toHaveCSS("z-index", "40");

    await gotoWithViteRetry(page, "/tracks");
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

    const artistLink = page.getByRole("link", {
      name: /continue as artist|i'm an artist/i,
    });
    await artistLink.scrollIntoViewIfNeeded();
    await artistLink.click();
    await expect(page).toHaveURL(/\/signup\/artist\/credentials$/);
    await expect(
      page.getByRole("heading", { name: /create artist account/i })
    ).toBeVisible();

    await gotoWithViteRetry(page, "/signup");
    await expect(
      page.getByRole("heading", { name: /join soundkit/i })
    ).toBeVisible();
    await expect(page.getByText("I'm a Fan")).toBeVisible();
    const fanLink = page.getByRole("link", {
      name: /continue as fan|i'm a fan/i,
    });
    await fanLink.scrollIntoViewIfNeeded();
    await fanLink.click();
    await expect(page).toHaveURL(/\/signup\/fan\/credentials$/);
    await expect(
      page.getByRole("heading", { name: /create fan account/i })
    ).toBeVisible();

    await gotoWithViteRetry(page, "/signup/artist/credentials");
    await expect(
      page.getByRole("heading", { name: /create artist account/i })
    ).toBeVisible();
    await expect(page.getByText("I'm an Artist")).toBeHidden();
  });

  test("artist profiles show owned media, features, and credits", async ({
    page,
  }) => {
    await gotoWithViteRetry(page, "/artist/luna-eclipse");

    await expect(
      page.getByRole("heading", { exact: true, name: "Luna Eclipse" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Videos" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Also Featured On" })
    ).toBeVisible();
    await expect(page.getByText("City Lights").first()).toBeVisible();

    await page.getByRole("tab", { name: "Credits" }).click();
    await expect(page).toHaveURL(/#credits$/);
    await expect(
      page.getByRole("heading", { exact: true, name: "Credits" })
    ).toBeVisible();
    await expect(page.getByText("Songwriter")).toBeVisible();

    await page.getByRole("tab", { name: "Tracks" }).click();
    await expect(page).toHaveURL(/#tracks$/);
    await expect(
      page.getByRole("heading", { exact: true, name: "Also Featured On" })
    ).toBeVisible();
  });

  test("live surfaces render while realtime implementation is pending", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await gotoWithViteRetry(page, "/live");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Live on SoundKit" })
    ).toBeVisible();

    await gotoWithViteRetry(page, "/live/battles");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/battle/i).first()).toBeVisible();

    await gotoWithViteRetry(page, "/live/parties");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/part/i).first()).toBeVisible();
    await expect(
      page.getByText("No listening parties are live right now.")
    ).toHaveCount(1);

    await gotoWithViteRetry(page, "/live/parties");
    await expect(
      page.getByRole("heading", { exact: true, name: "Listening Parties" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured" })).toBeVisible();

    await gotoWithViteRetry(page, "/live/streams");
    await expect(
      page.getByRole("heading", { exact: true, name: "Creator Streams" }).nth(1)
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured" })).toBeVisible();
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
    await expect(page.getByText("Hip-Hop/Rap").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Country" })).toBeVisible();
  });

  test("explore collection routes support shared all-results views", async ({
    page,
  }) => {
    await gotoWithViteRetry(page, "/tracks?view=all");
    await expect(
      page.getByRole("heading", { name: "All Songs" })
    ).toBeVisible();

    await gotoWithViteRetry(page, "/videos?view=all");
    await expect(
      page.getByRole("heading", { name: "All Videos" })
    ).toBeVisible();

    await gotoWithViteRetry(page, "/projects?view=all");
    await expect(
      page.getByRole("heading", { name: "All Projects" })
    ).toBeVisible();
  });

  test("creator live dashboards expose separate battle party and stream setup", async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard/live/challenge");

    await expect(
      page.getByRole("heading", { name: "Battle Requests" })
    ).toBeVisible();
    await expect(page.getByText("BattleBot handoff")).toBeVisible();
    await expect(page.getByText("Next-round lobby")).toBeVisible();

    await gotoWithViteRetry(page, "/dashboard/live/parties");
    await expect(
      page.getByRole("heading", { name: /Live.*Parties/i })
    ).toBeVisible();
    await expect(
      page.getByText(/party chat can reference timestamps/i)
    ).toBeVisible();
    await expect(page.getByText("RealtimeKit Defaults")).toBeVisible();

    await gotoWithViteRetry(page, "/dashboard/live/streams");
    await expect(
      page.getByRole("heading", { name: "Live Streams" })
    ).toBeVisible();
    await expect(page.getByText("Create Stream")).toBeVisible();
    await expect(page.getByText("RealtimeKit Layer").first()).toBeVisible();
  });

  test("live room detail pages expose chat, lyrics, and battle voting", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await gotoWithViteRetry(page, "/live/parties/single-album-party");
    await expect(
      page.getByRole("heading", { name: /single album spotlight/i }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/lyrics/i).first()).toBeVisible();
    await expect(page.getByText(/this room is synced/i).first()).toBeVisible();

    await gotoWithViteRetry(page, "/live/battles/battle-1");
    await expect(
      page.getByRole("heading", { name: /west coast showdown/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /vote dj nova/i })
    ).toBeVisible();
    await expect(page.getByText(/muted until turn/i)).toBeVisible();
    await expect(page.getByText("BattleBot Control")).toBeVisible();

    await gotoWithViteRetry(page, "/live/streams/stream-1");
    await expect(
      page.getByRole("heading", {
        name: /beat making from the first drum hit/i,
      })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "About" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Music" })).toBeVisible();
    await expect(page.getByText(/soundkit premium required/i)).toBeVisible();

    // Verify video detail route chat collapse & expand
    await gotoWithViteRetry(page, "/videos/video-1");
    await expect(page.getByText("Comments & Chat").first()).toBeVisible();
    await page.getByTitle("Collapse Chat").click();
    await expect(page.getByText("Comments & Chat")).toBeHidden();
    const expandVideoChat = page.getByRole("button", {
      name: /(expand chat|open live chat)/i,
    });
    await expect(expandVideoChat).toBeVisible();
    await expandVideoChat.click();
    await expect(page.getByText("Comments & Chat").first()).toBeVisible();

    // Verify Live Index retains standard layout & hero
    await gotoWithViteRetry(page, "/live");
    await expect(
      page.getByRole("heading", { name: /the pulse of soundkit/i })
    ).toBeVisible();
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
        domain: cookieDomain,
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
        domain: cookieDomain,
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
        domain: cookieDomain,
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
          selectedPlanCode: "soundkit_premium_artist",
          stateValue: "",
          step: 3,
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
        domain: cookieDomain,
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
