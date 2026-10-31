/* eslint-disable one-var, sort-vars */
import { expect, test } from "@playwright/test";

test("empty regional discovery keeps the map selection and labels recommendations", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const broaderRequests: string[] = [];
  await page.route("**/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("region") === "texas") {
      await route.fulfill({ json: [] });
      return;
    }
    if (url.searchParams.get("region") === "all")
      {broaderRequests.push(url.pathname);}
    await route.continue();
  });
  await page.goto("/?mapScope=usa&region=Texas&regionType=north-america", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("regional-empty-state")).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("heading", { name: "No releases in Texas yet" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Top Songs in Texas/u })
  ).toHaveCount(0);
  await expect(page.getByTestId("broader-recommendations")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Discover across SoundKit" })
  ).toBeVisible();
  await expect(page.getByTestId("home-rail")).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get("region")).toBe("Texas");
  expect(broaderRequests.length).toBeGreaterThan(0);
  expect(broaderRequests.every((path) => /^\/v1\/tracks\/?$/u.test(path))).toBe(
    true
  );
  await page
    .getByRole("button", { exact: true, name: "Explore all regions" })
    .click();
  await expect(page.getByTestId("regional-empty-state")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Top Songs On SoundKit" })
  ).toBeVisible();
});

test("regional request failures show retry instead of declaring a region empty", async ({
  page,
}) => {
  test.setTimeout(90_000);
  let failing = true;
  await page.route("**/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("region") === "texas") {
      await route.fulfill(
        failing
          ? { json: { message: "Fixture unavailable" }, status: 503 }
          : { json: [] }
      );
      return;
    }
    await route.continue();
  });
  await page.goto("/?mapScope=usa&region=Texas&regionType=north-america", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("alert")).toContainText(
    "Some results for Texas could not load.",
    { timeout: 60_000 }
  );
  await expect(page.getByTestId("regional-empty-state")).toHaveCount(0);
  await expect(page.getByTestId("broader-recommendations")).toHaveCount(0);
  failing = false;
  await page.getByRole("button", { exact: true, name: "Try again" }).click();
  await expect(page.getByTestId("regional-empty-state")).toBeVisible();
});
