/* eslint-disable one-var, sort-vars, node/no-top-level-await -- Integration fixture setup follows request order. */
import type { createDb } from "@soundkit/db";
import type { MerchEditorConfig } from "@soundkit/db/merch-design";
import { uploadIntents } from "@soundkit/db/schema/app";
import { user } from "@soundkit/db/schema/auth";
import {
  merchCatalogProducts,
  merchCatalogVariants,
  merchDesigns,
  merchMockups,
} from "@soundkit/db/schema/fulfillment";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type * as PrintfulModule from "@/lib/printful";
import type { AppEnv } from "@/lib/types";

import type cartRoutes from "./cart";
import type merchRoutes from "./merch";

const provider = vi.hoisted(() => ({
  createMockup: vi.fn(),
  status: "waiting",
  url: "",
}));
vi.mock("@/lib/printful", async (importOriginal) => ({
  ...(await importOriginal<typeof PrintfulModule>()),
  createPrintfulMockupTask: (body: unknown) => {
    provider.createMockup(body);
    return Promise.resolve({
      catalog_variant_mockups: [],
      failure_reasons: [],
      id: 999,
      status: "pending",
    });
  },
  getPrintfulFile: () =>
    Promise.resolve({
      height: 1200,
      id: 777,
      mime_type: "image/png",
      status: provider.status,
      url: provider.url,
      width: 1200,
    }),
  getPrintfulMockupStyles: () =>
    Promise.resolve([
      { mockup_styles: [{ id: 123 }], placement: "front", technique: "dtg" },
    ]),
  isPrintfulConfigured: () => true,
  registerPrintfulFile: ({ url }: { url: string }) => {
    provider.url = url;
    return Promise.resolve({ id: 777, url });
  },
}));
const url =
  process.env.SOUNDKIT_TEST_DATABASE_URL ??
  "postgres://soundkit_test:soundkit_test@127.0.0.1:5432/soundkit_test?sslmode=disable";
process.env.DATABASE_URL = url;
process.env.MEDIA_PUBLIC_URL = "https://media.example.test";
async function available() {
  const parsed = new URL(url);
  if (
    !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    parsed.pathname !== "/soundkit_test" ||
    process.env.SOUNDKIT_DISABLE_DB_TESTS === "true"
  ) {
    return false;
  }
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 1000,
  });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end();
  }
}
const ready = await available();
const owner = "db-test-merch-editor-owner";
const productId = "905540000";
const key = `uploads/${owner}/artwork.png`;
const config: MerchEditorConfig = {
  artwork: { height: 1200, width: 1200 },
  position: { height: 4, left: 2, top: 1, width: 4 },
  printArea: {
    dpi: 150,
    height: 10,
    placement: "front",
    technique: "dtg",
    width: 8,
  },
  variantIds: ["905540001", "905540002"],
  version: 1,
};
let db: ReturnType<typeof createDb>;
let routes: typeof merchRoutes;
let cart: typeof cartRoutes;
function appFor(userId: string) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("user", {
      banned: false,
      email: "merch-editor@test.dev",
      emailVerified: true,
      id: userId,
      name: "Merch artist",
    });
    return await next();
  });
  app.route("/merch", routes);
  app.route("/cart", cart);
  return app;
}
async function clean() {
  await db.delete(merchDesigns).where(eq(merchDesigns.ownerUserId, owner));
  await db.delete(uploadIntents).where(eq(uploadIntents.userId, owner));
  await db
    .delete(merchCatalogVariants)
    .where(eq(merchCatalogVariants.catalogProductId, productId));
  await db
    .delete(merchCatalogProducts)
    .where(eq(merchCatalogProducts.id, productId));
  await db.delete(user).where(eq(user.id, owner));
}
async function statusOf(response: Response | Promise<Response>) {
  const result = await response;
  return result.status;
}

describe.runIf(ready)("merch editor API with PostgreSQL", () => {
  beforeAll(async () => {
    const database = await import("@soundkit/db");
    const merch = await import("./merch");
    db = database.createDb();
    routes = merch.default;
    const cartModule = await import("./cart");
    cart = cartModule.default;
    await clean();
    await db.insert(user).values({
      createdAt: new Date(),
      email: "merch-editor@test.dev",
      emailVerified: true,
      id: owner,
      name: "Merch artist",
      updatedAt: new Date(),
    });
    await db.insert(merchCatalogProducts).values({
      id: productId,
      isCurated: true,
      name: "Test tee",
      placements: [{ placement: "front" }],
      printFileRules: {
        placements: [
          {
            dpi: 150,
            placement: "front",
            printAreaHeight: 10,
            printAreaType: "simple",
            printAreaWidth: 8,
            technique: "dtg",
          },
        ],
      },
      retailMaxCents: 6000,
      retailMinCents: 1800,
    });
    for (const id of config.variantIds) {
      await db.insert(merchCatalogVariants).values({
        basePriceCents: 1200,
        catalogProductId: productId,
        id,
        inStock: true,
        name: id,
      });
    }
    await db.insert(uploadIntents).values({
      expiresAt: new Date(Date.now() + 60_000),
      fileName: "artwork.png",
      id: "db-test-merch-editor-upload",
      mimeType: "image/png",
      objectKey: key,
      route: "media",
      sizeBytes: 15_000,
      userId: owner,
    });
  });
  afterAll(clean);
  it("saves positioned artwork, retries mockups, gates publication and protects published orders", async () => {
    const app = appFor(owner);
    const payload = {
      designFileObjectKey: key,
      editorConfig: config,
      placement: "front",
      printfulCatalogProductId: productId,
      retailPriceCents: 2500,
      technique: "dtg",
      title: "Editor tee",
    };
    const request = (path: string, method: string, body: unknown) =>
      app.request(`/merch${path}`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method,
      });
    const denied = await statusOf(
      request("/designs", "POST", {
        ...payload,
        designFileObjectKey: "uploads/other/art.png",
      })
    );
    expect(denied).toBe(400);
    const response = await request("/designs", "POST", payload);
    expect(response.status).toBe(201);
    const saved: { id: string; editorConfig: MerchEditorConfig } =
      await response.json();
    expect(saved.editorConfig.position).toEqual(config.position);
    const changed = { ...config, position: { ...config.position, left: 3 } };
    const edited = await statusOf(
      request(`/designs/${saved.id}`, "PATCH", {
        ...payload,
        editorConfig: changed,
      })
    );
    expect(edited).toBe(200);
    const first = await db
      .select()
      .from(merchMockups)
      .where(eq(merchMockups.merchDesignId, saved.id));
    expect(first).toHaveLength(2);
    const [black, white] = first;
    if (!black || !white) {
      throw new Error("Mockup fixtures missing");
    }
    const fulfillment = await import("@/lib/fulfillment-printful");
    await fulfillment.submitQueuedMockup({ mockupId: black.id });
    const expectedLayer = expect.objectContaining({
      position: changed.position,
    });
    const expectedPlacement = expect.objectContaining({
      layers: [expectedLayer],
    });
    const expectedProduct = expect.objectContaining({
      placements: [expectedPlacement],
    });
    expect(provider.createMockup).toHaveBeenCalledWith(
      expect.objectContaining({ products: [expectedProduct] })
    );
    await db
      .update(merchMockups)
      .set({
        mockupUrl: "https://media.example.test/mockup.png",
        status: "completed",
      })
      .where(eq(merchMockups.id, black.id));
    const incomplete = await statusOf(
      request(`/designs/${saved.id}`, "PATCH", { status: "published" })
    );
    expect(incomplete).toBe(400);
    await db
      .update(merchMockups)
      .set({ error: "provider test failure", status: "failed" })
      .where(eq(merchMockups.id, white.id));
    const retried = await statusOf(
      request(`/designs/${saved.id}/retry-mockups`, "POST", {})
    );
    expect(retried).toBe(200);
    const preserved = await db
      .select()
      .from(merchMockups)
      .where(
        and(eq(merchMockups.id, black.id), eq(merchMockups.status, "completed"))
      );
    expect(preserved).toHaveLength(1);
    await db
      .update(merchMockups)
      .set({
        mockupUrl: "https://media.example.test/mockup2.png",
        status: "completed",
      })
      .where(eq(merchMockups.id, white.id));
    const processing = await statusOf(
      request(`/designs/${saved.id}`, "PATCH", { status: "published" })
    );
    expect(processing).toBe(400);
    provider.status = "ok";
    const published = await statusOf(
      request(`/designs/${saved.id}`, "PATCH", { status: "published" })
    );
    expect(published).toBe(200);
    const cartResponse = await app.request("/cart/items", {
      body: JSON.stringify({
        merchDesignId: saved.id,
        printfulVariantId: config.variantIds[0],
        productType: "physical_merch",
        quantity: 1,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(cartResponse.status).toBe(201);
    const cartData: {
      items: { merchDesignId: string; printfulVariantId: string }[];
    } = await cartResponse.json();
    expect(cartData.items[0]).toMatchObject({
      merchDesignId: saved.id,
      printfulVariantId: config.variantIds[0],
    });
    await request(`/designs/${saved.id}`, "PATCH", { status: "draft" });
    const locked = await statusOf(
      request(`/designs/${saved.id}`, "PATCH", payload)
    );
    expect(locked).toBe(400);
    const foreign = await appFor("other-user").request(
      `/merch/designs/${saved.id}`,
      {
        body: JSON.stringify({ title: "Hijack" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }
    );
    expect(foreign.status).toBe(400);
  });
});
