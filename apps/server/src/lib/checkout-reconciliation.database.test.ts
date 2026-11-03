/* oxlint-disable one-var, sort-vars, unicorn/no-await-expression-member, promise/avoid-new -- Database fixture and controlled interleavings. */
import { randomUUID } from "node:crypto";

import { orders } from "@soundkit/db/schema/app";
import { user } from "@soundkit/db/schema/auth";
import { transactions } from "@soundkit/db/schema/payments";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import { runCheckoutReconciliation } from "./checkout-reconciliation";

const state = vi.hoisted(() => ({
  afterSelection: undefined as (() => Promise<void>) | undefined,
  db: undefined as unknown,
  logError: vi.fn(),
  logWarn: vi.fn(),
  request: vi.fn(),
}));
vi.mock("@soundkit/db", () => ({
  createDb: () => state.db,
  isDatabaseConfigured: () => true,
}));
vi.mock("./stripe", () => ({ stripeRequest: state.request }));
vi.mock("@/middleware/structured-logging", () => ({
  logError: state.logError,
  logInfo: vi.fn(),
  logWarn: state.logWarn,
}));
const url = process.env.SOUNDKIT_TEST_DATABASE_URL;
const local =
  url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
const rollback = new Error("fixture rollback");
type Db = Parameters<
  Parameters<ReturnType<typeof drizzle>["transaction"]>[0]
>[0];

async function fixture(run: (db: Db, id: string) => Promise<void>) {
  const client = new Client({
    application_name: "soundkit/test",
    connectionString: url,
  });
  await client.connect();
  const db = drizzle(client),
    id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(user)
        .values({ email: `${id}@example.test`, id, name: "Fixture" });
      await tx.insert(transactions).values({
        amountCents: 1000,
        artistAmountCents: 900,
        currency: "USD",
        id,
        platformFeeCents: 100,
        status: "pending",
        stripeCheckoutSessionId: `cs_${id}`,
        transactionType: "product_purchase",
      });
      await tx.insert(orders).values({
        buyerUserId: id,
        createdAt: new Date("2020-01-01T00:00:00Z"),
        id,
        status: "checkout_pending",
        stripeCheckoutSessionId: `cs_${id}`,
        transactionId: id,
      });
      // Intercept only the candidate-selection boundary; all reads/writes use PostgreSQL.
      state.db = new Proxy(tx, {
        get(target, prop, receiver) {
          if (prop !== "select") {
            return Reflect.get(target, prop, receiver);
          }
          return (...args: Parameters<typeof tx.select>) => {
            const query = tx.select(...args);
            const selectProxy = (value: object): object =>
              new Proxy(value, {
                get(object, key) {
                  const member = Reflect.get(object, key);
                  if (key === "then") {
                    return member.bind(object);
                  }
                  if (typeof member !== "function") {
                    return member;
                  }
                  return (...params: unknown[]) => {
                    const next = member.apply(object, params);
                    if (key === "limit") {
                      return Promise.resolve(next).then(async (rows) => {
                        const hook = state.afterSelection;
                        state.afterSelection = undefined;
                        await hook?.();
                        return rows;
                      });
                    }
                    return selectProxy(next);
                  };
                },
              });
            return selectProxy(query);
          };
        },
      });
      state.afterSelection = undefined;
      state.request.mockReset();
      state.logError.mockClear();
      state.logWarn.mockClear();
      state.request.mockResolvedValue({
        id: `cs_${id}`,
        payment_intent: null,
        payment_status: "unpaid",
        status: "expired",
      });
      await run(tx, id);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) {
      throw error;
    }
  } finally {
    state.db = undefined;
    state.afterSelection = undefined;
    await client.end();
  }
}

async function statuses(db: Db, id: string) {
  const [transaction] = await db
    .select({ status: transactions.status })
    .from(transactions)
    .where(eq(transactions.id, id));
  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, id));
  return [transaction?.status, order?.status];
}

describe.skipIf(!local)("stale checkout reconciliation", () => {
  it("reports bounded failure reasons at the appropriate level", async () => {
    await fixture(async (db, id) => {
      state.request.mockRejectedValueOnce(
        new DOMException("private provider timeout", "TimeoutError")
      );
      await runCheckoutReconciliation();
      expect(state.logWarn).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "timeout" })
      );
      state.request.mockResolvedValueOnce(null);
      await runCheckoutReconciliation();
      expect(state.logError).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "invalid_provider_response" })
      );
      state.request.mockRejectedValueOnce(
        new Error("private provider payload")
      );
      await runCheckoutReconciliation();
      expect(state.logError).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "reconciliation_failed" })
      );
      expect(
        JSON.stringify([
          ...state.logError.mock.calls,
          ...state.logWarn.mock.calls,
        ])
      ).not.toContain("private provider");
      expect(await statuses(db, id)).toEqual(["pending", "checkout_pending"]);
    });
  });

  it("session-less stale rows cannot consume the verifiable batch", async () => {
    await fixture(async (db, id) => {
      const ids = Array.from({ length: 50 }, () => randomUUID());
      await db.insert(transactions).values(
        ids.map((missingId) => ({
          amountCents: 1000,
          artistAmountCents: 900,
          id: missingId,
          platformFeeCents: 100,
          status: "pending" as const,
          transactionType: "product_purchase" as const,
        }))
      );
      await db.insert(orders).values(
        ids.map((missingId) => ({
          buyerUserId: id,
          createdAt: new Date("2019-01-01T00:00:00Z"),
          id: missingId,
          status: "checkout_pending" as const,
          transactionId: missingId,
        }))
      );
      expect((await runCheckoutReconciliation()).abandoned).toBe(1);
      expect(await statuses(db, id)).toEqual(["failed", "failed"]);
      expect(state.request).toHaveBeenCalledTimes(1);
      const pending = await db
        .select()
        .from(transactions)
        .where(inArray(transactions.id, ids));
      expect(pending.every((row) => row.status === "pending")).toBe(true);
    });
  });
  it("closes an expired session with an expanded canceled intent in one GET", async () => {
    await fixture(async (db, id) => {
      state.request.mockResolvedValue({
        id: `cs_${id}`,
        payment_intent: { id: `pi_${id}`, status: "canceled" },
        payment_status: "unpaid",
        status: "expired",
      });
      expect((await runCheckoutReconciliation()).abandoned).toBe(1);
      expect(await statuses(db, id)).toEqual(["failed", "failed"]);
      expect(state.request).toHaveBeenCalledTimes(1);
    });
  });

  it("concurrent sweeps close an expired checkout exactly once", async () => {
    const pool = new Pool({
      application_name: "soundkit/test",
      connectionString: url,
      max: 4,
    });
    const db = drizzle(pool),
      id = randomUUID();
    let release: (() => void) | undefined;
    const bothReading = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    try {
      await db.transaction(async (tx) => {
        await tx
          .insert(user)
          .values({ email: `${id}@example.test`, id, name: "Fixture" });
        await tx.insert(transactions).values({
          amountCents: 1000,
          artistAmountCents: 900,
          id,
          platformFeeCents: 100,
          status: "pending",
          stripeCheckoutSessionId: `cs_${id}`,
          transactionType: "product_purchase",
        });
        await tx.insert(orders).values({
          buyerUserId: id,
          createdAt: new Date("2020-01-01T00:00:00Z"),
          id,
          status: "checkout_pending",
          stripeCheckoutSessionId: `cs_${id}`,
          transactionId: id,
        });
      });
      state.db = db;
      state.request.mockReset();
      state.request.mockImplementation(async () => {
        reads += 1;
        if (reads === 2) {
          release?.();
        }
        await bothReading;
        return {
          id: `cs_${id}`,
          payment_intent: null,
          payment_status: "unpaid",
          status: "expired",
        };
      });
      const results = await Promise.all([
        runCheckoutReconciliation(),
        runCheckoutReconciliation(),
      ]);
      expect(results.reduce((sum, result) => sum + result.abandoned, 0)).toBe(
        1
      );
      const [payment] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, id));
      const [order] = await db.select().from(orders).where(eq(orders.id, id));
      expect([payment?.status, order?.status]).toEqual(["failed", "failed"]);
    } finally {
      release?.();
      state.db = undefined;
      await db.transaction(async (tx) => {
        await tx.delete(orders).where(eq(orders.id, id));
        await tx.delete(transactions).where(eq(transactions.id, id));
        await tx.execute(
          sql`DELETE FROM soundkit_analytics.events WHERE source_key=${`user:${id}`}`
        );
        await tx.delete(user).where(eq(user.id, id));
      });
      await pool.end();
    }
  });

  it("closes expired unpaid sessions idempotently using reads only", async () => {
    await fixture(async (db, id) => {
      expect(await runCheckoutReconciliation()).toEqual({
        abandoned: 1,
        skipped: false,
      });
      expect(await statuses(db, id)).toEqual(["failed", "failed"]);
      expect(await runCheckoutReconciliation()).toEqual({
        abandoned: 0,
        skipped: false,
      });
      expect(state.request).toHaveBeenCalledTimes(1);
      expect(state.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          path: `/checkout/sessions/cs_${id}`,
          signal: expect.any(AbortSignal),
        })
      );
    });
  });
  it.each([
    { payment_status: "unpaid", status: "open" },
    { payment_status: "paid", status: "complete" },
    { payment_status: "unpaid", status: "complete" },
    { payment_status: "paid", status: "expired" },
  ])("preserves uncertain or paid session %j", async (session) => {
    await fixture(async (db, id) => {
      state.request.mockResolvedValue({
        id: `cs_${id}`,
        payment_intent: null,
        ...session,
      });
      expect((await runCheckoutReconciliation()).abandoned).toBe(0);
      expect(await statuses(db, id)).toEqual(["pending", "checkout_pending"]);
    });
  });
  it.each([
    "processing",
    "succeeded",
    "requires_action",
    "requires_payment_method",
  ])("preserves an expired session with intent status %s", async (status) => {
    await fixture(async (db, id) => {
      state.request.mockResolvedValue({
        id: `cs_${id}`,
        payment_intent: { id: `pi_${id}`, status },
        payment_status: "unpaid",
        status: "expired",
      });
      expect((await runCheckoutReconciliation()).abandoned).toBe(0);
      expect(await statuses(db, id)).toEqual(["pending", "checkout_pending"]);
    });
  });
  it("retrieves a referenced intent and closes only when canceled", async () => {
    await fixture(async (db, id) => {
      await db
        .update(transactions)
        .set({ stripePaymentIntentId: `pi_${id}` })
        .where(eq(transactions.id, id));
      state.request.mockImplementation(({ path }) =>
        Promise.resolve(
          path.includes("checkout")
            ? {
                id: `cs_${id}`,
                payment_intent: `pi_${id}`,
                payment_status: "unpaid",
                status: "expired",
              }
            : { id: `pi_${id}`, status: "canceled" }
        )
      );
      expect((await runCheckoutReconciliation()).abandoned).toBe(1);
      expect(await statuses(db, id)).toEqual(["failed", "failed"]);
      expect(
        state.request.mock.calls.every(([request]) => request.method === "GET")
      ).toBe(true);
    });
  });
  it("preserves pending records when Stripe is unavailable or malformed", async () => {
    await fixture(async (db, id) => {
      state.request.mockRejectedValueOnce(
        new Error("private provider failure")
      );
      expect((await runCheckoutReconciliation()).abandoned).toBe(0);
      state.request.mockResolvedValueOnce(null);
      expect((await runCheckoutReconciliation()).abandoned).toBe(0);
      expect(await statuses(db, id)).toEqual(["pending", "checkout_pending"]);
    });
  });
  it("preserves a refund committed between candidate selection and cleanup", async () => {
    await fixture(async (db, id) => {
      state.afterSelection = async () => {
        await db
          .update(transactions)
          .set({ status: "refunded" })
          .where(eq(transactions.id, id));
        await db
          .update(orders)
          .set({ status: "refunded" })
          .where(eq(orders.id, id));
      };
      expect((await runCheckoutReconciliation()).abandoned).toBe(0);
      expect(await statuses(db, id)).toEqual(["refunded", "refunded"]);
    });
  });
  it("refuses mismatched session and intent bindings", async () => {
    await fixture(async (db, id) => {
      state.request.mockResolvedValueOnce({
        id: "cs_unrelated",
        payment_intent: null,
        payment_status: "unpaid",
        status: "expired",
      });
      expect((await runCheckoutReconciliation()).abandoned).toBe(0);
      await db
        .update(transactions)
        .set({ stripePaymentIntentId: "pi_different" })
        .where(eq(transactions.id, id));
      expect((await runCheckoutReconciliation()).abandoned).toBe(0);
      expect(await statuses(db, id)).toEqual(["pending", "checkout_pending"]);
    });
  });

  it("does not overwrite settlement after candidate selection", async () => {
    await fixture(async (db, id) => {
      state.afterSelection = async () => {
        await db
          .update(transactions)
          .set({ status: "succeeded" })
          .where(eq(transactions.id, id));
        await db
          .update(orders)
          .set({ status: "paid" })
          .where(eq(orders.id, id));
      };
      await runCheckoutReconciliation();
      expect(await statuses(db, id)).toEqual(["succeeded", "paid"]);
    });
  });
});
