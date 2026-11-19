/* eslint-disable one-var -- Keep browser actions and their observations in execution order. */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const products = [
    {
      brand: "Printful",
      id: "tee",
      image: "/placeholder.svg",
      isDiscontinued: false,
      name: "Premium heavyweight T-shirt",
      placements: [{ placement: "front" }, { placement: "back" }],
      retailMaxCents: 6000,
      retailMinCents: 1800,
      type: "T-SHIRT",
    },
    {
      brand: null,
      id: "mug",
      image: "/placeholder.svg",
      isDiscontinued: false,
      name: "Ceramic mug",
      placements: [{ placement: "default" }],
      retailMaxCents: 3500,
      retailMinCents: 1200,
      type: "MUG",
    },
    {
      brand: null,
      id: "retired",
      image: null,
      isDiscontinued: true,
      name: "Retired hoodie",
      placements: [],
      retailMaxCents: 6000,
      retailMinCents: 2000,
      type: "HOODIE",
    },
  ],
  variants = [
    {
      basePriceCents: 1300,
      catalogProductId: "tee",
      color: "Black",
      colorCode: "000000",
      id: "black-m",
      image: "/placeholder.svg",
      inStock: true,
      name: "Black / M",
      size: "M",
    },
    {
      basePriceCents: 1400,
      catalogProductId: "tee",
      color: "White",
      colorCode: "ffffff",
      id: "white-l",
      image: "/placeholder.svg",
      inStock: true,
      name: "White / L",
      size: "L",
    },
    {
      basePriceCents: 700,
      catalogProductId: "mug",
      color: "White",
      colorCode: "ffffff",
      id: "mug-white",
      image: "/placeholder.svg",
      inStock: false,
      name: "White",
      size: null,
    },
  ];
function design(id: string, status = "draft") {
  return {
    createdAt: "2026-11-19T00:00:00Z",
    description: null,
    designFileObjectKey: "merch/art.png",
    designFileUrl: null,
    id,
    mockupCount: 1,
    ownerUserId: "user_complete",
    placement: "front",
    platformFeeBps: 1200,
    printfulCatalogProductId: "tee",
    printfulFileId: null,
    projectId: null,
    publishedAt: null,
    readyMockupCount: 1,
    retailPriceCents: 2500,
    status,
    technique: "dtg",
    title: `Tour tee ${id}`,
    trackId: null,
  };
}
async function setup(page: Page, count = 1, includePhysical = true) {
  await page.context().addCookies([
    {
      domain: new URL(
        test.info().project.use.baseURL ?? "http://127.0.0.1:4311"
      ).hostname,
      name: "soundkit_test_session",
      path: "/",
      value: "complete",
    },
  ]);
  const designs = Array.from({ length: count }, (_, index) =>
    design(String(index + 1))
  );
  await page.route("**/v1/merch/**", async (route) => {
    const headers = {
        "access-control-allow-credentials": "true",
        "access-control-allow-origin": new URL(
          test.info().project.use.baseURL ?? "http://127.0.0.1:4311"
        ).origin,
      },
      path = new URL(route.request().url()).pathname;
    if (path.endsWith("/catalog")) {
      await route.fulfill({ headers, json: { products, variants } });
      return;
    }
    if (path.endsWith("/physical-releases")) {
      await route.fulfill({
        headers,
        json: includePhysical
          ? [
              {
                id: "cd",
                includesDigitalDownload: true,
                kunakiProductId: null,
                mediaFormat: "cd",
                projectId: "project",
                projectTitle: "Midnight EP",
                retailPriceCents: 1500,
                status: "draft",
                title: "Midnight EP CD",
              },
            ]
          : [],
      });
      return;
    }
    if (path.endsWith("/mockups")) {
      await route.fulfill({
        headers,
        json: [
          {
            catalogVariantId: "black-m",
            error: null,
            id: "mockup",
            mockupUrl: "/placeholder.svg",
            status: "completed",
          },
        ],
      });
      return;
    }
    if (route.request().method() === "POST") {
      const created = Object.assign(
        design("created"),
        route.request().postDataJSON()
      );
      designs.push(created);
      await route.fulfill({ headers, json: created, status: 201 });
      return;
    }
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON(),
        item = designs.find((entry) => path.endsWith(`/${entry.id}`));
      if (item) {
        Object.assign(item, body);
      }
      await route.fulfill({ headers, json: item });
      return;
    }
    if (route.request().method() === "DELETE") {
      const item = designs.find((entry) => path.endsWith(`/${entry.id}`));
      if (item) {
        item.status = "archived";
      }
      await route.fulfill({ headers, json: { success: true } });
      return;
    }
    await route.fulfill({ headers, json: designs });
  });
  await page.goto("/dashboard/career/merch", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { exact: true, name: "Merch Studio" })
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole("heading", {
      exact: true,
      name: `Products ${count + Number(includePhysical)}`,
    })
  ).toBeVisible({ timeout: 60_000 });
}

test("catalog browsing shows real options and carries the blank into creation", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await setup(page);
  await page
    .getByRole("button", { exact: true, name: "Create product" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Physical edition");
  await page.getByRole("button", { name: "Design merch" }).click();
  await expect(page.getByText("Your sound. Your signature.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Retired hoodie/u })
  ).toHaveCount(0);
  await page.getByRole("button", { exact: true, name: "Apparel" }).click();
  await expect(page.getByRole("button", { name: /Ceramic mug/u })).toHaveCount(
    0
  );
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("catalog.png"),
  });
  await page
    .getByRole("button", { name: /Premium heavyweight T-shirt/u })
    .click();
  const details = page.getByRole("dialog");
  await expect(details).toContainText("$13.00");
  await details.getByRole("button", { exact: true, name: "White" }).click();
  await expect(
    details.getByRole("button", { exact: true, name: "White" })
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("product-details.png"),
  });
  await details
    .getByRole("button", { name: "Continue with this product" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Make it yours" })
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Blank (apparel product)" })
  ).toContainText("Premium heavyweight T-shirt");
  await expect(
    page.getByRole("combobox", { exact: true, name: "Placement" })
  ).toContainText("front");
  await page
    .getByRole("textbox", { exact: true, name: "Title" })
    .fill("Midnight Tour tee");
  await page
    .getByRole("textbox", { name: "Print file URL" })
    .fill("https://media.mysoundkit.com/merch/tour.png");
  await page.getByLabel(/Retail price/u).fill("25");
  const creation = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith("/merch/designs")
  );
  await page
    .getByRole("button", { exact: true, name: "Create design" })
    .click();
  const submission = await creation;
  expect(submission.postDataJSON()).toMatchObject({
    placement: "front",
    printfulCatalogProductId: "tee",
    retailPriceCents: 2500,
  });
  await expect(
    page.getByText("Midnight Tour tee", { exact: true })
  ).toBeVisible();
});

test("product manager filters, paginates and preserves publishing and archive actions", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await setup(page, 11);
  await expect(page.getByText("1–10 of 12 products")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByText("Setup required: link a Kunaki product in your project.")
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search your products" })
    .fill("Tour tee 1");
  await expect(page.getByText("1–3 of 3 products")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("products.png"),
  });
  await page
    .getByRole("button", { exact: true, name: "Actions for Tour tee 1" })
    .click();
  await page.getByRole("menuitem", { exact: true, name: "Publish" }).click();
  await expect(
    page.getByText("Product published", { exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Actions for Tour tee 1" })
    .click();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Unpublish" })
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Archive product" }).click();
  await page
    .getByRole("button", { exact: true, name: "Archive product" })
    .click();
  await expect(
    page.getByText("Product archived", { exact: true })
  ).toBeVisible();
});

test("catalog search and unavailable products have honest empty and stock states", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await setup(page, 0);
  await page
    .getByRole("button", { exact: true, name: "Explore catalog" })
    .click();
  await page
    .getByRole("textbox", { name: "Search catalog" })
    .fill("no-such-product");
  await expect(
    page.getByText("No products found", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: /Ceramic mug/u }).click();
  await expect(
    page.getByRole("button", { name: "Continue with this product" })
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText(
    "currently out of stock"
  );
});

test("empty manager offers creation and catalog failures remain distinct from an empty catalog", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await setup(page, 0, false);
  await expect(
    page.getByRole("heading", { name: "Your next drop starts here" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Create your first product" }).click();
  await page.getByRole("button", { name: "Design merch" }).click();
  await expect(
    page.getByRole("button", { name: /Premium heavyweight T-shirt/u })
  ).toBeVisible();
  await page.route("**/v1/merch/catalog", (route) =>
    route.fulfill({ json: { message: "Catalog unavailable" }, status: 503 })
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Your next drop starts here" })
  ).toBeVisible({ timeout: 60_000 });
  await page
    .getByRole("button", { exact: true, name: "Explore catalog" })
    .click();
  await expect(
    page.getByText("The catalog couldn't load.", { exact: true })
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByText("No products found", { exact: true })
  ).toHaveCount(0);
  await page.route("**/v1/merch/catalog", (route) =>
    route.fulfill({ json: { products: [], variants: [] } })
  );
  await page.getByRole("button", { exact: true, name: "Try again" }).click();
  await expect(
    page.getByText("The merch catalog is being prepared.", { exact: false })
  ).toBeVisible();
});
