/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-await, require-unicode-regexp, prefer-named-capture-group */
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
  test.beforeEach(async ({ context }, testInfo) => {
    await context.setExtraHTTPHeaders({
      "x-soundkit-test-id": `${testInfo.testId}-${testInfo.project.name}`,
    });
  });

  test("artist messages stay synchronized across full and floating chat", async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(
      page,
      "/dashboard/messages?conversationId=mock-conversation-rhythm"
    );
    await expect(
      page.getByText("Your latest verse is sounding great.")
    ).toBeVisible({ timeout: 60_000 });

    await gotoWithViteRetry(page, "/");
    await expect(
      page.getByRole("button", { name: "Open artist chat" })
    ).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Dashboard" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open artist chat" }).click();
    await expect(page.getByText("Messages").last()).toBeVisible();
    await page
      .getByRole("button", { name: /MC Rhythm/ })
      .last()
      .click();
    await expect(
      page.getByText("Let’s sync on the hook when you have a minute.")
    ).toBeVisible();

    await page.getByTitle("Enlarge to full messages page").click();
    await expect(page).toHaveURL(/\/dashboard\/messages/);
    await expect(
      page.getByText("I left a third note in the thread.")
    ).toBeVisible();
  });

  test("battle chat shares global presence status", async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/live/battles/battle-waiting-artist");
    await expect(page.getByText("Waiting Room Chat")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByLabel("MC Rhythm is online")).toBeVisible({
      timeout: 60_000,
    });
  });

  test("playback uses the responsive player presentation", async ({ page }) => {
    test.setTimeout(90_000);

    await gotoWithViteRetry(page, "/tracks/track_summer_nights");
    await page.getByRole("button", { exact: true, name: "Play" }).click();

    if ((page.viewportSize()?.width ?? 0) < 768) {
      await expect(
        page.getByRole("button", { name: "Expand player" })
      ).toBeVisible({ timeout: 60_000 });
    } else {
      await expect(
        page.getByRole("button", { name: "Minimize player" })
      ).toBeVisible({ timeout: 60_000 });
    }
  });

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

  test("Explore keeps rails contained and applies real map scopes", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await gotoWithViteRetry(
      page,
      "/?regionType=global&region=all&mapScope=global"
    );

    await expect(
      page.getByRole("heading", { exact: true, name: "Top Songs On SoundKit" })
    ).toBeVisible();
    await expect(page.getByTestId("explore-map")).toBeVisible();
    await expect(page.getByTestId("explore-page")).toHaveAttribute(
      "data-hydrated",
      "true",
      { timeout: 60_000 }
    );

    const hasPageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasPageOverflow).toBe(false);

    const firstRail = page.getByTestId("home-rail").first(),
      railSizes = await firstRail.evaluate((rail) => ({
        clientWidth: rail.clientWidth,
        scrollWidth: rail.scrollWidth,
      }));
    expect(railSizes.scrollWidth).toBeGreaterThanOrEqual(railSizes.clientWidth);

    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: "Africa" }).click();
    } else {
      await page.getByRole("button", { exact: true, name: "Africa" }).click();
    }

    await expect(page).toHaveURL(/mapScope=africa/);
    await expect(
      page.getByRole("heading", { exact: true, name: "Top Songs in Africa" })
    ).toBeVisible();
  });

  test("artist profiles show owned media, features, and credits", async ({
    page,
  }) => {
    // On a cold dev server this is often the first load of the artist route;
    // vite's dependency-optimization reload loop can consume the default
    // 30s budget before the route finishes hydrating.
    test.setTimeout(90_000);

    await gotoWithViteRetry(page, "/artist/luna-eclipse");

    // Cold dev servers spend ~25-45s hydrating the first load of this route
    // (vite dependency discovery + on-demand module transforms), so the first
    // assertion gets a generous window inside the 90s test budget.
    await expect(
      page.getByRole("heading", { exact: true, name: "Luna Eclipse" })
    ).toBeVisible({ timeout: 60_000 });
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
    await expect(
      page.getByRole("heading", { exact: true, name: "Performance" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Songwriting" })
    ).toBeVisible();
    await expect(page.getByText("Songwriter")).toBeVisible();

    await page.getByRole("tab", { name: "Tracks" }).click();
    await expect(page).toHaveURL(/#tracks$/);
    await expect(
      page.getByRole("heading", { exact: true, name: "Also Featured On" })
    ).toBeVisible();
  });

  test("live surfaces render current battle discovery rails", async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/live");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Live on SoundKit" })
    ).toBeVisible();

    await gotoWithViteRetry(
      page,
      "/live/battles?regionType=north-america&region=us-arkansas"
    );
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/battle/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Live Now" })).toBeVisible();
    await expect(
      page.getByText("Artist Battle - Hip-Hop - BO5").first()
    ).toBeVisible();
    await expect(page.getByText("Hip-Hop • BO5", { exact: true })).toHaveCount(
      0
    );
    await expect(page.getByText("BO5").first()).toBeVisible();
    await expect(page.getByText(/Round 1\/5/).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Electronic" })
    ).toHaveCount(0);
    const battleEntryLink = page
      .locator('a[href="/live/battles/battle_west_coast_showdown"]')
      .filter({ hasText: /watch live|join waiting room/i })
      .first();
    await expect(battleEntryLink).toBeVisible();
    await expect(battleEntryLink).toHaveAttribute(
      "href",
      "/live/battles/battle_west_coast_showdown"
    );
    await gotoWithViteRetry(page, "/live/battles/battle_west_coast_showdown");
    await expect(
      page.getByRole("heading", { name: "Artist Battle - Hip-Hop" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /vote dj nova/i })
    ).toBeVisible();
    await gotoWithViteRetry(
      page,
      "/live/battles?regionType=north-america&region=us-arkansas"
    );
    await expect(
      page.getByRole("heading", { exact: true, name: "Upcoming" })
    ).toBeVisible();
    await expect(
      page.getByText("Artist Battle - Hip-Hop - BO3").first()
    ).toBeVisible();
    await expect(page.getByText("Luna Eclipse").first()).toBeVisible();
    await expect(page.getByText("Neon Pulse").first()).toBeVisible();
    await expect(page).toHaveURL(/region=us-arkansas/);
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await expect(page.getByRole("combobox")).toHaveCount(4);
    }
    await gotoWithViteRetry(
      page,
      "/live/battles/upcoming?regionType=north-america&region=us-arkansas"
    );
    await expect(
      page.getByRole("heading", { name: "Upcoming Battles" })
    ).toBeVisible();
    await expect(
      page.getByText("Artist Battle - Hip-Hop - BO3").first()
    ).toBeVisible();

    await gotoWithViteRetry(
      page,
      "/live/battles?regionType=north-america&region=us-arkansas"
    );
    const battlesContentBox = await page
        .getByRole("heading", { exact: true, name: "Live Battles" })
        .nth(1)
        .boundingBox(),
      battlesContentX = battlesContentBox?.x;

    await gotoWithViteRetry(
      page,
      "/live/parties?regionType=north-america&region=us-arkansas"
    );
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/part/i).first()).toBeVisible();
    await expect(
      page.getByText("No listening parties are live right now.")
    ).toHaveCount(1);
    await expect(page).toHaveURL(/region=us-arkansas/);
    await expect(
      page.getByRole("combobox", { name: "Filter live events by status" })
    ).toHaveCount(0);
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await expect(page.getByRole("combobox")).toHaveCount(4);
    }
    const partiesContentBox = await page
        .getByRole("heading", { exact: true, name: "Listening Parties" })
        .boundingBox(),
      partiesContentX = partiesContentBox?.x;
    expect(battlesContentX).toBeDefined();
    expect(partiesContentX).toBeDefined();
    expect(
      Math.abs((battlesContentX ?? 0) - (partiesContentX ?? 0))
    ).toBeLessThan(2);

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
    await expect(
      page.getByRole("combobox", { name: "Filter live events by status" })
    ).toHaveCount(0);
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await expect(page.getByRole("combobox")).toHaveCount(4);
    }
  });

  test("notification actions reconcile the bell, list, and unread count", async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard/live/battles");
    const notificationsButton = page.getByRole("button", {
      name: "Notifications",
    });
    await expect(notificationsButton).toBeVisible({ timeout: 60_000 });
    await notificationsButton.click();
    await expect(page.getByText("New battle invitation")).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("button", { name: "Mark all read" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(
      page.getByRole("button", { name: "Mark all read" })
    ).toHaveCount(0);
    await expect(page.getByText("New battle invitation")).toBeVisible();

    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByText("No notifications yet.")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("button", { name: "Clear all" })).toHaveCount(
      0
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await notificationsButton.click();
    await expect(page.getByText("No notifications yet.")).toBeVisible({
      timeout: 60_000,
    });
  });

  test("failed notification actions restore authoritative state", async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);

    await context.setExtraHTTPHeaders({
      "x-soundkit-fail-notification-action": "read-all",
    });
    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard/live/battles");
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByText("New battle invitation")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Mark all read" }).click();

    // The fixture rejects the write. The collection must re-read the server
    // state instead of leaving the optimistic all-read state on screen.
    await expect(
      page.getByRole("button", { name: "Mark all read" })
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("New battle invitation")).toBeVisible();
  });

  test("battle chat uses the shared presence source", async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/live/battles/battle-waiting-artist");
    await expect(page.getByText("Waiting Room Chat")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByLabel("MC Rhythm is online")).toBeVisible({
      timeout: 60_000,
    });
  });

  test("communities ask before joining and support member chat", async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/communities/community_luna");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Join Luna Eclipse Circle?")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Join for free" }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 60_000 });
    await expect(
      page.getByRole("heading", { exact: true, name: "Luna Eclipse Circle" })
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByRole("switch", { name: "Receive creator post notifications" })
    ).toBeVisible();

    const message = page.getByLabel("Message Luna Eclipse Circle");
    await message.fill("Hello from the community.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Hello from the community.")).toBeVisible();

    await page.getByRole("button", { name: "updates" }).click();
    await page.getByLabel("Write a community update").fill("New release notes");
    await page.getByRole("button", { name: "Post update" }).click();
    await expect(page.getByText("New release notes")).toBeVisible();
  });

  test("track management stays in the three-dot actions", async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard/tracks");
    await expect(
      page.getByRole("heading", { exact: true, name: "Tracks" })
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Edit Track", { exact: true })).toHaveCount(0);
    await expect(
      page.locator('a[href*="/dashboard/tracks/"][href$="/edit"]')
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: "Actions for Summer Nights" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Edit track details" })
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Manage audio files" })
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Retry media processing" })
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Edit track details" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit track details" })
    ).toBeVisible();
    await expect(page.getByLabel("Track name")).toHaveValue("Summer Nights");
    await expect(page.getByLabel("Visibility")).toBeVisible();
    await expect(page.getByLabel("Allow downloads")).toBeVisible();
    await page.keyboard.press("Escape");

    await page
      .getByRole("button", { name: "Actions for Summer Nights" })
      .click();
    await page.getByRole("menuitem", { name: "Manage audio files" }).click();
    await expect(
      page.getByRole("heading", { name: "Manage audio files" })
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await gotoWithViteRetry(page, "/dashboard/tracks/track_summer_nights/edit");
    await expect(page).toHaveURL(/\/dashboard\/tracks\/track_summer_nights$/);
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
    await expect(page.getByRole("combobox", { name: "Genre" })).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Country" })
    ).toHaveCount(0);
  });

  test("creator video titles open first-party analytics", async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard/videos");
    await page
      .getByRole("link", { exact: true, name: "Midnight Vibes" })
      .click();

    await expect(page).toHaveURL(
      /\/dashboard\/videos\/video_midnight_vibes_mv$/
    );
    await expect(
      page.getByRole("heading", { exact: true, name: "Midnight Vibes" })
    ).toBeVisible();
    await expect(page.getByText("Views over time")).toBeVisible();
    await expect(page.getByText("Arkansas, USA")).toBeVisible();
  });

  test("external video analytics explains unavailable playback milestones", async ({
    context,
    page,
  }) => {
    const analyticsRequests = [];
    page.on("request", (request) => {
      if (
        request.url().includes("/v1/videos/video_all_votes_matter/analytics")
      ) {
        analyticsRequests.push(request.url());
      }
    });

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard/videos");
    await page
      .getByRole("link", { exact: true, name: "All Votes Matter" })
      .click();

    await expect(page).toHaveURL(
      /\/dashboard\/videos\/video_all_votes_matter$/
    );
    await expect(
      page.getByRole("heading", { exact: true, name: "All Votes Matter" })
    ).toBeVisible();
    await expect(page.getByText("External source analytics")).toBeVisible();
    await expect(
      page.getByText(
        /external players do not send reliable playback milestones/i
      )
    ).toBeVisible();
    await expect
      .poll(() => analyticsRequests.length, {
        message: "external videos should not request first-party analytics",
      })
      .toBe(0);
  });

  test("hosted video analytics exposes a retryable failure", async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);

    let shouldFail = true;
    await page.route(
      "**/v1/videos/video_midnight_vibes_mv/analytics*",
      async (route) => {
        if (!shouldFail) {
          await route.continue();
          return;
        }

        await route.fulfill({
          body: JSON.stringify({
            code: "service_unavailable",
            message: "Analytics backend is warming up.",
          }),
          contentType: "application/json",
          status: 503,
        });
      }
    );

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard/videos");
    await page
      .getByRole("link", { exact: true, name: "Midnight Vibes" })
      .click();

    await expect(
      page.getByText("Analytics are temporarily unavailable.")
    ).toBeVisible();
    await expect(
      page.getByText("Analytics backend is warming up.")
    ).toBeVisible();

    shouldFail = false;
    await page.getByRole("button", { name: "Retry analytics" }).click();
    await expect(page.getByText("Arkansas, USA")).toBeVisible();
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

  test("public projects load cards and project details", async ({ page }) => {
    test.setTimeout(90_000);

    await gotoWithViteRetry(
      page,
      "/projects?region=all&regionType=north-america&view=all"
    );
    await expect(
      page.getByRole("heading", { name: "All Projects" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "After Dark" })
    ).toBeVisible({ timeout: 60_000 });

    await page.getByRole("link", { exact: true, name: "After Dark" }).click();
    await expect(
      page.getByRole("heading", { exact: true, name: "After Dark" })
    ).toBeVisible();
    await expect(page.getByText("Tracklist (2 Songs)")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Stream Summer Nights" })
    ).toBeVisible();
  });

  test("incoming battle invitations create upcoming battles", async ({
    context,
    page,
  }) => {
    test.setTimeout(120_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard/live/battles");
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(
      page.getByText("Challenge Accepted", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Request update failed")).toHaveCount(0);
    await expect(page.getByText("scheduled", { exact: true })).toHaveCount(2);
  });

  test("creator live dashboards expose separate battle party and stream setup", async ({
    context,
    page,
  }) => {
    // The dashboard shell and live route are code-split; on a cold Vite server,
    // dependency discovery can take longer than the suite's default timeout.
    test.setTimeout(90_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard/live/battles");

    await expect(
      page.getByText(/Battle Requests & Challenges/i).first()
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByText(/Review incoming challenge requests/i)
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Enter Artist Room" }).first()
    ).toBeVisible();
    await page.getByRole("link", { name: "Enter Artist Room" }).first().click();
    await expect(page).toHaveURL(
      /\/dashboard\/live\/battles\/join\/battle-waiting-artist\/artistview$/
    );
    await expect(
      page.getByText("Artist Battle Waiting Room", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Battle Chat", { exact: true })).toBeVisible();

    await gotoWithViteRetry(page, "/dashboard/live/battles");
    await page.getByRole("tab", { name: /outgoing/i }).click();
    await expect(page.getByText("To: @accepted-artist")).toHaveCount(0);
    await expect(page.getByText("To: @stale-artist")).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("To: @stale-artist")).toHaveCount(0);

    await page.getByLabel("Opponent").fill("@new-opponent");
    await expect(
      page.getByText("@new-opponent", { exact: false })
    ).toBeVisible();
    await page.getByLabel("Date").fill("2026-09-30");
    await page.getByLabel("Time").fill("20:00");
    await page.getByRole("button", { name: "Send Battle Request" }).click();
    await expect(page.getByText("To: @new-opponent")).toBeVisible();
    await page
      .getByRole("button", {
        name: "More actions for Artist Battle - Hip-Hop",
      })
      .first()
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Share upcoming battle" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await gotoWithViteRetry(page, "/dashboard/live/my-kit");
    await expect(
      page.getByRole("heading", { name: "My Battle Kits" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Create Kit" }).click();
    await page.getByLabel("Battle Kit name").fill("Regression Kit");
    await page.getByRole("button", { name: "Add main" }).nth(0).click();
    await page.getByRole("button", { name: "Add main" }).nth(0).click();
    await page.getByRole("button", { name: "Add main" }).nth(0).click();
    await page.getByRole("button", { name: "TB" }).last().click();
    await page.getByRole("button", { name: "Save Kit" }).click();
    await expect(page.getByText("Regression Kit")).toBeVisible();
    await page.getByRole("link", { name: "Use Kit" }).click();
    await expect(page).toHaveURL(/\/dashboard\/live\/battles/);
    await expect(
      page.getByText(/Regression Kit will be ready when you enter/i)
    ).toBeVisible();

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

  test("artist setup guide keeps optional actions in a compact accordion", async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard");
    await expect(page.getByText("Artist setup")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Publish an Open Verse")).toHaveCount(0);

    await page
      .getByRole("button", {
        name: /Explore what.s next.*Keep building beyond the essentials/i,
      })
      .click();
    await expect(page.getByText("Publish an Open Verse")).toBeVisible();

    await page.getByRole("button", { name: "Minimize setup guide" }).click();
    await expect(
      page.getByRole("button", { name: /Next: Explore/ })
    ).toBeVisible();
    await expect(page.getByText("Publish an Open Verse")).toHaveCount(0);

    await page.getByRole("button", { name: /Next: Explore/ }).click();
    await expect(page.getByText("Publish an Open Verse")).toBeVisible();
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
      page.getByRole("heading", { name: /artist battle - hip-hop/i })
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

  test("video comments support mentions and nested replies", async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/videos/video-1");
    await expect(page.getByText("Comments & Chat").first()).toBeVisible({
      timeout: 60_000,
    });
    const commentInput = page.getByRole("textbox", {
      name: "Write a comment",
    });
    await commentInput.fill("Great work @mu");
    await expect(
      page.getByRole("button", { name: /Music Fan\s*@musicfan99/i })
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Music Fan\s*@musicfan99/i })
      .click();
    await expect(commentInput).toHaveValue("Great work @musicfan99 ");
    await commentInput.fill("Great work @musicfan99");
    await commentInput.press("Enter");
    await expect(page.getByText("Great work @musicfan99")).toBeVisible();

    await page.getByRole("button", { name: "Reply" }).first().click();
    const replyInput = page.getByRole("textbox", { name: "Write a reply" });
    await expect(page.getByText(/Replying to/)).toBeVisible();
    await replyInput.fill("Thanks for listening!");
    await replyInput.press("Enter");
    await expect(page.getByText("Thanks for listening!")).toBeVisible();
  });

  test("completed battles stay visible but cannot be re-entered", async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await gotoWithViteRetry(page, "/live/battles/battle-completed-result");
    await expect(
      page.getByRole("heading", { name: "Completed Artist Battle" })
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Read-only result")).toBeVisible();
    await expect(page.getByText("Battle ended in a tie")).toBeVisible();
    await expect(
      page.getByText(
        "BattleBot: The battle is complete. The final result is locked, and this room is now read-only."
      )
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /choose next/i })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Join Queue" })).toHaveCount(
      0
    );
    await expect(page.getByText("LIVE", { exact: true })).toHaveCount(0);

    await gotoWithViteRetry(page, "/dashboard/live/battles");
    await expect(page.getByText("Battle Feed & History")).toBeVisible({
      timeout: 60_000,
    });
    const completedBattleRow = page
      .getByText("Completed Artist Battle", { exact: true })
      .locator("xpath=../../..");
    await expect(
      completedBattleRow.getByRole("link", { name: "View Result" })
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      completedBattleRow.getByRole("link", { name: "Enter Artist Room" })
    ).toHaveCount(0);
    await expect(
      completedBattleRow.getByRole("button", { name: /forfeit|cancel/i })
    ).toHaveCount(0);

    await gotoWithViteRetry(page, "/live/battles");
    await expect(page.getByText("Recent Results")).toBeVisible();
    await expect(page.getByText("Completed Artist Battle")).toBeVisible();

    await gotoWithViteRetry(
      page,
      "/dashboard/live/battles/join/battle-completed-result/artistview"
    );
    await expect(page).toHaveURL(/\/live\/battles\/battle-completed-result$/);
  });

  test("assigned artists are notified and routed to their live battle room", async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "participant",
      },
    ]);

    await gotoWithViteRetry(page, "/tracks");
    await expect(
      page.getByRole("heading", { name: "Your live battle is ready" })
    ).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: /West Coast Showdown/ }).click();
    await expect(page).toHaveURL(
      /\/dashboard\/live\/battles\/join\/battle-west-coast-showdown\/artistview$/
    );
    await expect(
      page.getByText("Artist room", { exact: true }).first()
    ).toBeVisible();
  });

  test("non-participants fall back from direct artist-room URLs", async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "nonparticipant",
      },
    ]);

    await gotoWithViteRetry(
      page,
      "/dashboard/live/battles/join/battle-waiting-artist/artistview"
    );
    await expect(page).toHaveURL(/\/live\/battles\/battle-waiting-artist$/, {
      timeout: 60_000,
    });
  });

  test("artist listening parties use a private artist room", async ({
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

    await gotoWithViteRetry(page, "/live/parties/single-album-party");
    if ((await page.getByText("Artist room", { exact: true }).count()) === 0) {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await expect(page).toHaveURL(
      /\/dashboard\/live\/parties\/join\/single-album-party\/artistview$/
    );
    await expect(page.getByText("Artist room", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Repeat current track" })
    ).toBeVisible();
    await expect(page.getByText("Party Chat", { exact: true })).toBeVisible();
  });

  test("fans can join a battle queue without navigating away", async ({
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

    await gotoWithViteRetry(page, "/live/battles/battle-west-coast-showdown");
    await expect(page.getByRole("button", { name: "Join Queue" })).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Join Queue" }).click();
    await expect(page.getByText("In Queue", { exact: true })).toBeVisible();
  });

  test("artist battle waiting rooms expose lineup controls", async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);

    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "complete",
      },
    ]);

    await page.addInitScript(() => {
      const { mediaDevices } = navigator;
      if (!mediaDevices) {
        return;
      }

      Object.defineProperty(mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => new MediaStream(),
      });
      Object.defineProperty(mediaDevices, "enumerateDevices", {
        configurable: true,
        value: async () => [
          {
            deviceId: "camera-1",
            groupId: "group-1",
            kind: "videoinput",
            label: "Built-in camera",
          },
          {
            deviceId: "microphone-1",
            groupId: "group-1",
            kind: "audioinput",
            label: "Built-in microphone",
          },
        ],
      });
    });

    await gotoWithViteRetry(page, "/live/battles/battle-waiting-artist");
    await expect(page).toHaveURL(
      /\/dashboard\/live\/battles\/join\/battle-waiting-artist\/artistview$/,
      { timeout: 60_000 }
    );
    await expect(page.getByText("Artist Battle Waiting Room")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Prepare your battle lineup")).toBeVisible();
    await expect(page.getByText("0/2 ready")).toBeVisible();
    await expect(
      page.getByText("#1 Complete Artist vs #7 MC Rhythm", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("BattleBot", { exact: true })).toBeVisible();
    await expect(page.getByText("BOT", { exact: true })).toBeVisible();
    await expect(
      page.getByText("BOT", { exact: true }).locator("svg")
    ).toHaveCount(0);
    const botMessage = page.getByText(
      "BattleBot: both artists are preparing the stage.",
      { exact: true }
    );
    await expect(botMessage).toHaveClass(/text-white/);
    await expect(botMessage.locator("xpath=../..")).toHaveClass(
      /bg-purple-600/
    );
    await expect(botMessage.locator("xpath=../..")).not.toHaveClass(
      /border-l-2/
    );
    await expect(
      page.locator('img[alt="SoundKit branded battle backdrop"]')
    ).toHaveAttribute("src", /soundkit-default-banner/);
    await expect(
      page.locator('[data-slot="message-scroller-viewport"]')
    ).toHaveCSS("overflow-y", "auto");
    await expect(page.getByRole("button", { name: "Help" })).toBeVisible();
    await expect(
      page.getByText("Best of 3 · 3 rounds + tiebreaker")
    ).toBeVisible();
    await page.waitForTimeout(500);

    const battleKitSelect = page.getByRole("combobox", { name: "Battle Kit" });
    await expect(battleKitSelect).toBeVisible();
    await battleKitSelect.click();
    await expect(
      page.getByRole("option", { name: /BEST OF 3 Warmup Kit/i })
    ).toBeVisible();
    await page.getByRole("option", { name: /BEST OF 3 Warmup Kit/i }).click();
    await page.getByRole("button", { name: "Lock Kit" }).click();
    await expect(page.getByText("Kit locked", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Locked for battle" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enable camera & mic" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Enable camera & mic" }).click();
    await expect(
      page.getByRole("combobox", { name: "Battle camera" })
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Battle microphone" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Save device setup" }).click();
    await expect(
      page.getByRole("button", { name: "Device setup saved" })
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("soundkit.battleMediaDevices.v1")
        )
      )
      .toContain('"videoDeviceId":"camera-1"');
    await expect(page.getByRole("button", { name: "I’m ready" })).toBeVisible();
    await page.getByRole("button", { name: "I’m ready" }).click();
    await expect(page.getByRole("button", { name: "Not ready" })).toBeVisible();
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
    test.setTimeout(90_000);
    await context.addCookies([
      {
        domain: cookieDomain,
        name: "soundkit_test_session",
        path: "/",
        value: "admin",
      },
    ]);

    await gotoWithViteRetry(page, "/dashboard/admin");

    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Gross revenue")).toBeVisible();
    await expect(page.getByText("$125.00")).toBeVisible();

    await page.getByRole("tab", { name: "Users" }).click();
    const usersTable = page.getByRole("table");
    await expect(usersTable.getByText("cg@rocktownlabs.com")).toBeVisible();
    await expect(usersTable.getByText("artist@example.com")).toBeVisible();

    const genresTab = page.getByRole("tab", { name: "Genres" });
    await genresTab.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Genre Catalog", { exact: true })
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Projects" })
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Battles" })
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Open Verses" })
    ).toBeVisible();

    const regionsTab = page.getByRole("tab", { name: "Regions" });
    await regionsTab.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Regional catalog coverage")).toBeVisible();
    await expect(page.getByText("United States")).toBeVisible();
    await expect(page.getByText("Arkansas")).toBeVisible();

    const openVersesTab = page.getByRole("tab", { name: "Open Verses" });
    await openVersesTab.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Open Verse Catalog")).toBeVisible();
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const listingRow = page.getByRole("row", {
        name: /IYKYK open verse listing title/u,
      });
      await expect(listingRow).toBeVisible();
      await expect(listingRow.getByText("Legacy / incomplete")).toBeVisible();
    } else {
      await expect(
        page.getByText("IYKYK open verse listing title").first()
      ).toBeVisible();
      await expect(page.getByText("Legacy / incomplete").first()).toBeVisible();
    }
    await page
      .getByRole("button", {
        name: "Delete IYKYK open verse listing title",
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Delete this Open Verse?" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete listing" }).click();
    await expect(page.getByText("Open Verse deleted")).toBeVisible();
  });
});
