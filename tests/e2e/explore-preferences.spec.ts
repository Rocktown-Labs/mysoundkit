import { expect, test } from "@playwright/test";

const HYDRATION_ERROR_PATTERN = /hydration|hydrating|#418/iu;

test("saved explore preferences restore after hydration", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.addInitScript(() => {
    localStorage.setItem("exploreRegion", "us-arkansas");
    localStorage.setItem("exploreMapScope", "usa");
    localStorage.setItem("exploreRegionType", "north-america");
    localStorage.setItem("soundkit_user_location", "Arkansas");
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("explore-page")).toHaveAttribute(
    "data-hydrated",
    "true",
    { timeout: 60_000 }
  );
  await expect(
    page.getByText(
      "Viewing music stats focused on Arkansas. Click another region or switch map scope."
    )
  ).toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Reset to Global View" })
    .click();
  await expect(
    page.getByText("Personalize your local scene", { exact: true })
  ).toBeVisible();
  expect(
    errors.filter((message) => HYDRATION_ERROR_PATTERN.test(message))
  ).toEqual([]);
});
