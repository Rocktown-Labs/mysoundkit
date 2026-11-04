/* oxlint-disable one-var, sort-vars, unicorn/max-nested-calls -- Transactional local database fixtures. */
import {
  orderItems,
  orders,
  purchases,
  tracks,
  projects,
  projectTracks,
} from "@soundkit/db/schema/app";
import { user } from "@soundkit/db/schema/auth";
import { paymentRefunds, transactions } from "@soundkit/db/schema/payments";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { expect, it } from "vitest";

import { readableTrack } from "./library-track-visibility";
import { purchaseEntitlementCondition } from "./purchase-entitlements";

const url = process.env.SOUNDKIT_TEST_DATABASE_URL;
interface PurchaseFixture {
  amount?: number;
  project?: boolean;
  refunds?: { amount: number; id: string }[];
  status?: "pending" | "succeeded" | "refunded";
  withoutTransaction?: boolean;
}

async function fixture(
  run: (
    db: NodePgDatabase,
    ids: { buyer: string; seller: string; track: string; prefix: string }
  ) => Promise<void>
) {
  if (
    !url ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
  ) {
    throw new Error("Explicit local entitlement test database required");
  }
  const client = new Client({
    application_name: "soundkit/test",
    connectionString: url,
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    const db = drizzle(client),
      prefix = crypto.randomUUID(),
      ids = {
        buyer: `${prefix}-buyer`,
        prefix,
        seller: `${prefix}-seller`,
        track: `${prefix}-track`,
      };
    await db.insert(user).values([
      {
        email: `${ids.buyer}@example.test`,
        id: ids.buyer,
        name: "Fixture buyer",
      },
      {
        email: `${ids.seller}@example.test`,
        id: ids.seller,
        name: "Fixture seller",
      },
    ]);
    await db.insert(tracks).values({
      id: ids.track,
      isPublic: false,
      ownerUserId: ids.seller,
      slug: ids.track,
      title: "Synthetic private purchased track",
    });
    await run(db, ids);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}

async function purchase(
  db: NodePgDatabase,
  ids: { buyer: string; seller: string; track: string; prefix: string },
  options: PurchaseFixture = {}
) {
  const id = crypto.randomUUID(),
    transactionId = options.withoutTransaction ? null : `${id}-transaction`,
    projectId = options.project ? `${id}-project` : null;
  if (projectId) {
    await db.insert(projects).values({
      id: projectId,
      ownerUserId: ids.seller,
      projectType: "ep",
      slug: projectId,
      title: "Fixture project",
    });
    await db
      .insert(projectTracks)
      .values({ position: 1, projectId, trackId: ids.track });
  }
  if (transactionId) {
    await db.insert(transactions).values({
      amountCents: options.amount ?? 1000,
      artistAmountCents: 900,
      buyerUserId: ids.buyer,
      id: transactionId,
      platformFeeCents: 100,
      sellerUserId: ids.seller,
      status: options.status ?? "succeeded",
      transactionType: "product_purchase",
    });
    for (const refund of options.refunds ?? []) {
      await db
        .insert(paymentRefunds)
        .values({
          amountCents: refund.amount,
          id: `${id}-${refund.id}`,
          stripeRefundId: refund.id,
          transactionId,
        })
        .onConflictDoNothing();
    }
  }
  await db.insert(orders).values({
    buyerUserId: ids.buyer,
    id,
    status: options.status === "refunded" ? "refunded" : "paid",
    totalCents: options.amount ?? 1000,
    transactionId,
  });
  await db.insert(orderItems).values({
    id: `${id}-item`,
    orderId: id,
    priceSnapshot: "10.00",
    productType: projectId ? "project" : "track",
    projectId,
    titleSnapshot: "Fixture purchase",
    trackId: projectId ? null : ids.track,
  });
  await db.insert(purchases).values({
    buyerUserId: ids.buyer,
    id: `${id}-purchase`,
    orderItemId: `${id}-item`,
    projectId,
    trackId: projectId ? null : ids.track,
  });
  return `${id}-purchase`;
}

it
  .runIf(Boolean(url) && process.env.SOUNDKIT_DISABLE_DB_TESTS !== "true")
  .each([
    { expected: true, label: "paid with no refund" },
    {
      expected: true,
      label: "confirmed partial refund",
      refunds: [{ amount: 400, id: "re_partial" }],
      status: "succeeded",
    },
    {
      expected: true,
      label: "legacy refunded status after only a partial refund",
      refunds: [{ amount: 400, id: "re_partial_legacy" }],
      status: "refunded",
    },
    {
      expected: false,
      label: "confirmed full refund",
      refunds: [{ amount: 1000, id: "re_full" }],
      status: "refunded",
    },
    {
      expected: false,
      label: "cumulative partial refunds reaching full amount",
      refunds: [
        { amount: 400, id: "re_first" },
        { amount: 600, id: "re_second" },
      ],
      status: "refunded",
    },
    {
      expected: true,
      label: "duplicate partial refund facts",
      refunds: [
        { amount: 500, id: "re_duplicate" },
        { amount: 500, id: "re_duplicate" },
      ],
      status: "refunded",
    },
    {
      expected: true,
      label: "ambiguous legacy charge total",
      refunds: [{ amount: 1000, id: "ch_legacy" }],
      status: "refunded",
    },
    {
      expected: true,
      label: "pending reconciliation",
      refunds: [{ amount: 1000, id: "re_pending_fixture" }],
      status: "pending",
    },
    {
      amount: 0,
      expected: true,
      label: "free zero-value order",
      status: "refunded",
    },
    {
      expected: true,
      label: "order with no payment transaction",
      withoutTransaction: true,
    },
  ] satisfies (PurchaseFixture & { label: string; expected: boolean })[])(
  "$label",
  async (options) => {
    await fixture(async (db, ids) => {
      const id = await purchase(db, ids, options),
        history = await db
          .select({ id: purchases.id })
          .from(purchases)
          .where(eq(purchases.id, id)),
        entitled = await db
          .select({ id: purchases.id })
          .from(purchases)
          .where(and(eq(purchases.id, id), purchaseEntitlementCondition())),
        readable = await db
          .select({ id: tracks.id })
          .from(tracks)
          .where(and(eq(tracks.id, ids.track), readableTrack(ids.buyer)));
      expect(history).toHaveLength(1);
      expect(entitled).toHaveLength(options.expected ? 1 : 0);
      expect(readable).toHaveLength(options.expected ? 1 : 0);
    });
  }
);

it.runIf(Boolean(url) && process.env.SOUNDKIT_DISABLE_DB_TESTS !== "true")(
  "revokes project-derived access without revoking another retained purchase",
  async () => {
    await fixture(async (db, ids) => {
      await purchase(db, ids, {
        project: true,
        refunds: [{ amount: 1000, id: "re_project" }],
        status: "refunded",
      });
      const before = await db
        .select({ id: tracks.id })
        .from(tracks)
        .where(and(eq(tracks.id, ids.track), readableTrack(ids.buyer)));
      expect(before).toHaveLength(0);
      await purchase(db, ids);
      const after = await db
          .select({ id: tracks.id })
          .from(tracks)
          .where(and(eq(tracks.id, ids.track), readableTrack(ids.buyer))),
        stranger = await db
          .select({ id: tracks.id })
          .from(tracks)
          .where(and(eq(tracks.id, ids.track), readableTrack("not-the-buyer")));
      expect(after).toHaveLength(1);
      expect(stranger).toHaveLength(0);
    });
  }
);

it.runIf(Boolean(url) && process.env.SOUNDKIT_DISABLE_DB_TESTS !== "true")(
  "revokes every digital item in the fully refunded order while preserving receipts",
  async () => {
    await fixture(async (db, ids) => {
      const firstId = await purchase(db, ids, {
          refunds: [{ amount: 1000, id: "re_shared_order" }],
          status: "refunded",
        }),
        [firstItem] = await db
          .select({ itemId: orderItems.id, orderId: orderItems.orderId })
          .from(purchases)
          .innerJoin(orderItems, eq(orderItems.id, purchases.orderItemId))
          .where(eq(purchases.id, firstId)),
        secondTrack = `${ids.prefix}-second-track`,
        secondItem = `${ids.prefix}-second-item`;
      expect(firstItem).toBeDefined();
      if (!firstItem) {
        throw new Error("Shared-order fixture item missing");
      }
      await db
        .update(orderItems)
        .set({ priceSnapshot: "5.00" })
        .where(eq(orderItems.id, firstItem.itemId));
      await db.insert(tracks).values({
        id: secondTrack,
        isPublic: false,
        ownerUserId: ids.seller,
        slug: secondTrack,
        title: "Second shared-order track",
      });
      await db.insert(orderItems).values({
        id: secondItem,
        orderId: firstItem.orderId,
        priceSnapshot: "5.00",
        productType: "track",
        titleSnapshot: "Second item",
        trackId: secondTrack,
      });
      await db.insert(purchases).values({
        buyerUserId: ids.buyer,
        id: `${ids.prefix}-second-purchase`,
        orderItemId: secondItem,
        trackId: secondTrack,
      });
      const history = await db
          .select({ id: purchases.id })
          .from(purchases)
          .where(eq(purchases.buyerUserId, ids.buyer)),
        entitled = await db
          .select({ id: purchases.id })
          .from(purchases)
          .where(
            and(
              eq(purchases.buyerUserId, ids.buyer),
              purchaseEntitlementCondition()
            )
          );
      expect(history).toHaveLength(2);
      expect(entitled).toHaveLength(0);
    });
  }
);
