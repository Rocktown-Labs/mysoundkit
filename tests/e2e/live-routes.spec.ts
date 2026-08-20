import { expect, test } from "@playwright/test";

const fanPasswordKey = ["SOUNDKIT", "E2E", "FAN", "PASSWORD"].join("_"),
  apiBaseUrl = process.env.PLAYWRIGHT_API_URL?.replace(/\/+$/u, "") ?? "",
  routeIds = {
    battle: process.env.SOUNDKIT_E2E_LIVE_BATTLE_ID,
    party: process.env.SOUNDKIT_E2E_LIVE_PARTY_ID,
    stream: process.env.SOUNDKIT_E2E_LIVE_STREAM_ID,
  },
  requiredEnv = [
    "PLAYWRIGHT_API_URL",
    "SOUNDKIT_E2E_FAN_EMAIL",
    fanPasswordKey,
    routeIds.battle,
    routeIds.party,
    routeIds.stream,
  ];

const missingEnv = requiredEnv.some((value) => !value),
  realE2eEnabled = process.env.SOUNDKIT_REAL_E2E === "true";

test.describe("real live route smoke", () => {
  test.skip(
    !realE2eEnabled || missingEnv,
    "Set SOUNDKIT_REAL_E2E and seeded live-route environment variables to run."
  );

  test("battle, stream, and party pages render persisted rooms", async ({
    page,
    request,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.SOUNDKIT_E2E_FAN_EMAIL ?? "");
    await page
      .getByLabel("Password")
      .fill(process.env[fanPasswordKey] ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    for (const [kind, id] of Object.entries(routeIds)) {
      const response = await request.get(`${apiBaseUrl}/v1/live/rooms/${id}`);
      expect(response.ok(), `${kind} room API should be available`).toBe(true);

      await page.goto(`/live/${kind === "party" ? "parties" : `${kind}s`}/${id}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page).not.toHaveText(/room offline|unable to load live room/i);
    }
  });
});

