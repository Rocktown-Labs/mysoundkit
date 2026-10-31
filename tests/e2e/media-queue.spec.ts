/* eslint-disable one-var, sort-vars */
import { expect, test } from "@playwright/test";

const apiOrigin =
  process.env.PLAYWRIGHT_API_URL ??
  process.env.SOUNDKIT_E2E_API_URL ??
  "http://127.0.0.1:3000";
const song = {
  artist: "Queue Artist",
  autoplay: false,
  cover: "/placeholder.svg",
  id: "queue-song-one",
  src: `${apiOrigin}/fixture-audio.wav`,
  title: "Queue song one",
};
const nextSong = { ...song, id: "queue-song-two", title: "Queue song two" };
const youtube = {
  artist: "CG Stewart",
  autoplay: true,
  id: "video:video_all_votes_matter",
  mediaType: "video",
  src: "https://www.youtube.com/watch?v=4U4tFM8iapc",
  title: "All Votes Matter",
  video: {
    externalPlaybackUrl: "https://www.youtube.com/watch?v=4U4tFM8iapc",
    verifiedOnPlatform: false,
    videoId: "video_all_votes_matter",
  },
};
const youtubeMock = `
window.__queueYouTubePlayers = [];
window.YT = { Player: class {
  constructor(mount, options) {
    this.options = options; this.time = 17; this.state = 2;
    this.iframe = document.createElement('iframe'); this.iframe.src = 'about:blank';
    this.iframe.dataset.queueIdentity = 'original'; mount.replaceWith(this.iframe);
    window.__queueYouTubePlayers.push(this);
    queueMicrotask(() => { options.events.onReady({target:this}); });
  }
  playVideo() { this.state = 1; this.options.events.onStateChange({ data:1, target:this }); }
  pauseVideo() { this.state = 2; this.options.events.onStateChange({ data:2, target:this }); }
  getPlayerState() { return this.state; }
  getCurrentTime() { return this.time; }
  getDuration() { return 120; }
  seekTo(time) { this.time = time; }
  finish() { this.state = 0; this.options.events.onStateChange({ data:0, target:this }); }
  destroy() { this.iframe.remove(); }
}};
`;

test.beforeEach(async ({ page }) => {
  // Deterministic local audio keeps the native engine ready without external media.
  const samples = Buffer.alloc(8000 * 2 * 30);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(16_000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples.length, 40);
  await page.route("**/fixture-audio.wav", (route) =>
    route.fulfill({
      body: Buffer.concat([header, samples]),
      contentType: "audio/wav",
    })
  );
});

for (const first of ["audio", "video"] as const) {
  test(`mixed ${first} queue preserves YouTube across routes and advances to music`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.addInitScript(youtubeMock);
    await page.addInitScript(
      ({ firstItem, items }) => {
        localStorage.setItem(
          "soundkit.audio-player.v1:anonymous",
          JSON.stringify({
            currentTrack: firstItem,
            queue: items,
            recentlyPlayed: [],
            visible: true,
          })
        );
      },
      {
        firstItem: first === "audio" ? song : youtube,
        items:
          first === "audio" ? [song, youtube, nextSong] : [youtube, nextSong],
      }
    );
    await page.route("**/v1/ads/serve?**", (route) =>
      route.fulfill({ status: 204 })
    );
    await page.goto("/videos/video_all_votes_matter", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId("queued-video-preview")).toBeVisible({
      timeout: 60_000,
    });
    if (first === "audio") {
      await expect(page.locator("audio")).toHaveAttribute(
        "src",
        /fixture-audio\.wav/u
      );
      await page
        .locator("audio")
        .evaluate((audio) => audio.dispatchEvent(new Event("ended")));
    }
    const player = page.getByTestId("video-queue-player");
    await expect(player).toBeVisible({ timeout: 30_000 });
    await expect(player.locator("iframe")).toHaveAttribute(
      "data-queue-identity",
      "original"
    );
    await expect(page.locator("audio")).toHaveCount(0);
    if (first === "video") {
      await player
        .getByRole("button", { exact: true, name: "Play video" })
        .click();
    }
    await expect(
      player.getByRole("button", { exact: true, name: "Pause video" })
    ).toBeVisible();
    await page.locator('a[href="/"]').filter({ visible: true }).first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await expect(player.locator("iframe")).toHaveAttribute(
      "data-queue-identity",
      "original"
    );
    expect(await page.evaluate("window.__queueYouTubePlayers.length")).toBe(1);
    expect(
      await page.evaluate("window.__queueYouTubePlayers[0].getCurrentTime()")
    ).toBe(17);
    await page.evaluate("window.__queueYouTubePlayers[0].finish()");
    await expect(player).toHaveCount(0);
    await expect(page.locator("audio")).toHaveAttribute(
      "src",
      /fixture-audio\.wav/u
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem("soundkit.audio-player.v1:anonymous") ?? "{}"
            ).currentTrack?.id
        )
      )
      .toBe("queue-song-two");
  });
}

test("hosted video PiP uses the persistent media element and music replaces it", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const hosted = {
    ...youtube,
    id: "video:video_battle_replay",
    src: "/media/test-video.mp4",
    title: "Hosted queue video",
    video: {
      externalPlaybackUrl: "/media/test-video.mp4",
      verifiedOnPlatform: true,
      videoId: "video_battle_replay",
    },
  };
  await page.addInitScript(
    ({ current, next }) =>
      localStorage.setItem(
        "soundkit.audio-player.v1:anonymous",
        JSON.stringify({
          currentTrack: current,
          queue: [current, next],
          recentlyPlayed: [],
          visible: true,
        })
      ),
    { current: hosted, next: nextSong }
  );
  await page.route("**/media/test-video.mp4", (route) =>
    route.fulfill({ body: "", contentType: "video/mp4" })
  );
  await page.goto("/videos/video_battle_replay", {
    waitUntil: "domcontentloaded",
  });
  const player = page.getByTestId("video-queue-player");
  await expect(player.locator("video")).toBeVisible({ timeout: 60_000 });
  await player.locator("video").evaluate((video) => {
    video.dataset.queueIdentity = "hosted-original";
    Object.defineProperty(document, "pictureInPictureEnabled", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "pictureInPictureElement", {
      configurable: true,
      value: null,
    });
    video.requestPictureInPicture = () => {
      video.dataset.pipRequested = "true";
      return Promise.resolve({} as PictureInPictureWindow);
    };
  });
  await player
    .getByRole("button", { exact: true, name: "Picture-in-picture" })
    .click();
  await expect(player.locator("video")).toHaveAttribute(
    "data-pip-requested",
    "true"
  );
  await page.locator('a[href="/"]').filter({ visible: true }).first().click();
  await expect(player.locator("video")).toHaveAttribute(
    "data-queue-identity",
    "hosted-original"
  );
  await player.getByRole("button", { exact: true, name: "Next media" }).click();
  await expect(player).toHaveCount(0);
  await expect(page.locator("audio")).toHaveAttribute(
    "src",
    /fixture-audio\.wav/u
  );
});

test("anonymous player never restores another account or legacy private queue", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(
    (privateItem) => {
      const state = JSON.stringify({
        currentTrack: privateItem,
        queue: [privateItem],
        visible: true,
      });
      localStorage.setItem("soundkit.audio-player.v1", state);
      localStorage.setItem("soundkit.audio-player.v1:other-account", state);
    },
    { ...song, title: "PRIVATE ACCOUNT PLAYBACK MARKER" }
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("explore-page")).toHaveAttribute(
    "data-hydrated",
    "true",
    { timeout: 60_000 }
  );
  await expect(page.getByText("PRIVATE ACCOUNT PLAYBACK MARKER")).toHaveCount(
    0
  );
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("soundkit.audio-player.v1"))
    )
    .toBeNull();
});
