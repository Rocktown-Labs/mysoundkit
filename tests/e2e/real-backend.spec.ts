import { expect, test } from "@playwright/test";

interface JsonResponse<T> {
  body: T;
  status: number;
}

interface MeResponse {
  user: {
    accountType: "artist" | "fan";
    id: string;
    onboardingCompletedAt: string | null;
    username: string;
  };
}

interface TrackSummary {
  id: string;
  isForSale: boolean;
  isPublic: boolean;
  priceCents: number | null;
  title: string;
}

interface ProjectSummary {
  id: string;
  projectType: "album" | "ep" | "single";
  title: string;
  trackCount: number;
}

interface SearchResponse {
  artists: { id: string; location: string; name: string }[];
  projects: { id: string; title: string }[];
  tracks: { id: string; title: string }[];
}

interface OpenVersePage {
  items: { id: string; title: string; trackId: string }[];
}

interface CheckoutResponse {
  checkoutUrl?: string | null;
  message?: string;
  setupRequired?: boolean;
  transactionId?: string | null;
}

const requiredEnvNames = [
  "PLAYWRIGHT_BASE_URL",
  "PLAYWRIGHT_API_URL",
  "SOUNDKIT_E2E_ARTIST_EMAIL",
  "SOUNDKIT_E2E_ARTIST_PASSWORD",
  "SOUNDKIT_E2E_FAN_EMAIL",
  "SOUNDKIT_E2E_FAN_PASSWORD",
] as const,

 realE2eEnabled = process.env.SOUNDKIT_REAL_E2E === "true",
 missingEnv = requiredEnvNames.filter((name) => !process.env[name]),
 apiBaseUrl = process.env.PLAYWRIGHT_API_URL?.replace(/\/+$/, "") ?? "",
 searchState = process.env.SOUNDKIT_E2E_SEARCH_STATE ?? "AR",
 realE2eEnv = {
  artistEmail: process.env.SOUNDKIT_E2E_ARTIST_EMAIL ?? "",
  artistPassword: process.env.SOUNDKIT_E2E_ARTIST_PASSWORD ?? "",
  fanEmail: process.env.SOUNDKIT_E2E_FAN_EMAIL ?? "",
  fanPassword: process.env.SOUNDKIT_E2E_FAN_PASSWORD ?? "",
  webBaseUrl: process.env.PLAYWRIGHT_BASE_URL ?? "",
},

 uniqueName = (prefix: string) =>
  `${prefix} ${new Date().toISOString().replaceAll(/[:.]/g, "-")}`,

 apiJson = async <T>({
  data,
  method = "GET",
  path,
  request,
}: {
  data?: unknown;
  method?: "DELETE" | "GET" | "POST";
  path: string;
  request: typeof test extends { request: infer R } ? R : never;
}): Promise<JsonResponse<T>> => {
  const response = await request.fetch(`${apiBaseUrl}${path}`, {
    data,
    failOnStatusCode: false,
    method,
  }),
   text = await response.text();

  return {
    body: text ? (JSON.parse(text) as T) : ({} as T),
    status: response.status(),
  };
},

 expectOk = <T>(response: JsonResponse<T>, label: string) => {
  expect(response.status, `${label}: ${JSON.stringify(response.body)}`).toBe(
    200
  );
},

 expectCreated = <T>(response: JsonResponse<T>, label: string) => {
  expect(response.status, `${label}: ${JSON.stringify(response.body)}`).toBe(
    201
  );
},

 login = async ({
  email,
  page,
  password,
}: {
  email: string;
  page: Parameters<Parameters<typeof test>[1]>[0]["page"];
  password: string;
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
};

test.describe("real backend artist and fan smoke flow", () => {
  test.skip(!realE2eEnabled, "Set SOUNDKIT_REAL_E2E=true to run real E2E.");
  test.skip(
    missingEnv.length > 0,
    `Missing real E2E env: ${missingEnv.join(", ")}`
  );

  test.describe.configure({ mode: "serial" });

  test("artist content can be created, discovered, and added to a fan cart", async ({
    page,
    request,
  }) => {
    const health = await apiJson<{
      database: string;
      databaseConfigured: boolean;
      ok: boolean;
    }>({ path: "/health", request });

    expectOk(health, "API health");
    expect(health.body.ok).toBe(true);
    expect(health.body.databaseConfigured).toBe(true);
    expect(health.body.database).toBe("connected");

    await login({
      email: realE2eEnv.artistEmail,
      page,
      password: realE2eEnv.artistPassword,
    });

    const artistMe = await apiJson<MeResponse>({ path: "/v1/me", request });
    expectOk(artistMe, "artist /v1/me");
    expect(artistMe.body.user.accountType).toBe("artist");
    expect(artistMe.body.user.onboardingCompletedAt).toBeTruthy();

    const trackTitle = uniqueName("E2E Arkansas Track"),
     track = await apiJson<TrackSummary>({
      data: {
        assetIds: [],
        catalogItemType: "single",
        description: "Created by the real backend E2E flow.",
        genre: "Rap",
        isForSale: true,
        isPublic: true,
        price: 1.99,
        priceCents: 199,
        productionStatus: "complete",
        purchaseMode: "digital_download",
        releaseStrategy: "publish_when_ready",
        title: trackTitle,
      },
      method: "POST",
      path: "/v1/tracks",
      request,
    });

    expect([201, 403], `track create: ${JSON.stringify(track.body)}`).toContain(
      track.status
    );

    if (track.status === 403) {
      expect(JSON.stringify(track.body)).toContain("Stripe Connect");
      test.info().annotations.push({
        description:
          "Artist account can sign in, but seller onboarding is required before creating for-sale tracks.",
        type: "payment-setup",
      });
      return;
    }

    expectCreated(track, "track create");
    expect(track.body.title).toBe(trackTitle);

    const openVerseTitle = `${trackTitle} Open Verse`,
     openVerse = await apiJson<{ id: string; title: string }>({
      data: {
        description: "Real E2E open verse listing.",
        maxSubmissions: 10,
        title: openVerseTitle,
        trackId: track.body.id,
      },
      method: "POST",
      path: "/v1/open-verses",
      request,
    });
    expectCreated(openVerse, "open verse create");

    const projectTitle = uniqueName("E2E Arkansas EP"),
     project = await apiJson<ProjectSummary>({
      data: {
        assetIds: [],
        collaboratorNames: [],
        description: "Created by the real backend E2E flow.",
        isPublic: true,
        newTracks: [],
        projectType: "ep",
        releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        title: projectTitle,
        trackIds: [track.body.id],
      },
      method: "POST",
      path: "/v1/projects",
      request,
    });
    expectCreated(project, "project create");

    const party = await apiJson<{ id: string; projectId: string }>({
      data: {
        description: "Real E2E listening party.",
        playbackMode: "artist_hosted",
        projectId: project.body.id,
        scheduledStartAt: new Date(
          Date.now() + 8 * 24 * 60 * 60 * 1000
        ).toISOString(),
        title: `${projectTitle} Listening Party`,
      },
      method: "POST",
      path: "/v1/listening-parties",
      request,
    });
    expectCreated(party, "listening party create");

    const artistSearch = await apiJson<SearchResponse>({
      path: `/v1/search?q=${encodeURIComponent(trackTitle)}&state=${encodeURIComponent(
        searchState
      )}&type=tracks&limit=10`,
      request,
    });
    expectOk(artistSearch, "artist search");
    expect(
      artistSearch.body.tracks.some((item) => item.id === track.body.id)
    ).toBe(true);

    const openVerseSearch = await apiJson<OpenVersePage>({
      path: `/v1/open-verses?q=${encodeURIComponent(trackTitle)}&limit=10`,
      request,
    });
    expectOk(openVerseSearch, "open verse search");
    expect(
      openVerseSearch.body.items.some((item) => item.id === openVerse.body.id)
    ).toBe(true);

    await page.goto("/login");
    await page.context().clearCookies();

    await login({
      email: realE2eEnv.fanEmail,
      page,
      password: realE2eEnv.fanPassword,
    });

    const fanMe = await apiJson<MeResponse>({ path: "/v1/me", request });
    expectOk(fanMe, "fan /v1/me");
    expect(fanMe.body.user.accountType).toBe("fan");
    expect(fanMe.body.user.onboardingCompletedAt).toBeTruthy();

    const fanSearch = await apiJson<SearchResponse>({
      path: `/v1/search?q=${encodeURIComponent(trackTitle)}&state=${encodeURIComponent(
        searchState
      )}&type=tracks&limit=10`,
      request,
    });
    expectOk(fanSearch, "fan search");
    expect(
      fanSearch.body.tracks.some((item) => item.id === track.body.id)
    ).toBe(true);

    const cart = await apiJson<{ itemCount: number; totalCents: number }>({
      data: {
        productType: "track",
        quantity: 1,
        trackId: track.body.id,
      },
      method: "POST",
      path: "/v1/cart/items",
      request,
    });
    expectCreated(cart, "cart add");
    expect(cart.body.itemCount).toBeGreaterThan(0);
    expect(cart.body.totalCents).toBeGreaterThanOrEqual(199);

    const checkout = await apiJson<CheckoutResponse>({
      data: {
        cancelUrl: `${realE2eEnv.webBaseUrl}/library/purchased`,
        successUrl: `${realE2eEnv.webBaseUrl}/library/purchased`,
      },
      method: "POST",
      path: "/v1/payments/checkout",
      request,
    });

    if (process.env.SOUNDKIT_E2E_EXPECT_CHECKOUT === "true") {
      expectOk(checkout, "checkout");
      expect(checkout.body.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe/);
      expect(checkout.body.transactionId).toBeTruthy();
      return;
    }

    expect(
      [200, 400],
      `checkout preflight: ${JSON.stringify(checkout.body)}`
    ).toContain(checkout.status);
  });
});
