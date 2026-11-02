/* oxlint-disable one-var, sort-vars, unicorn/max-nested-calls -- Isolated database fixture and provider mocks. */
import { randomUUID } from "node:crypto";

import { paymentRefunds, transactions } from "@soundkit/db/schema/payments";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { describe, expect, it, vi } from "vitest";

import { syncConfirmedStripeRefunds } from "./stripe-refunds";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./stripe", () => ({ stripeRequest: request }));
const url = process.env.SOUNDKIT_TEST_DATABASE_URL;
const local =
  url && ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);
type TestDb = Parameters<
  Parameters<ReturnType<typeof drizzle>["transaction"]>[0]
>[0];
const rollback = new Error("fixture rollback");

async function fixture(
  run: (db: TestDb, id: string, intent: string) => Promise<void>,
  pending = false
) {
  const client = new Client({
    application_name: "soundkit/test",
    connectionString: url,
  });
  await client.connect();
  const db = drizzle(client),
    id = randomUUID(),
    intent = `pi_${id}`;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(transactions).values({
        amountCents: 1000,
        artistAmountCents: 900,
        currency: "USD",
        id,
        platformFeeCents: 100,
        status: pending ? "pending" : "succeeded",
        stripeCheckoutSessionId: "cs_fixture",
        stripePaymentIntentId: pending ? null : intent,
        transactionType: "product_purchase",
      });
      request.mockReset();
      await run(tx, id, intent);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) {
      throw error;
    }
  } finally {
    await client.end();
  }
}

function provider(
  intent: string,
  refunds: Record<string, unknown>[],
  options: {
    id?: string;
    paginate?: boolean;
    sessionIntent?: string;
    unavailable?: boolean;
    withoutMetadata?: boolean;
  } = {}
) {
  request.mockImplementation(({ method, path, params }) => {
    expect(method).toBe("GET");
    if (options.unavailable) {
      throw new Error("provider unavailable");
    }
    if (path === "/charges/ch_fixture") {
      return Promise.resolve({
        amount: 1000,
        captured: true,
        currency: "usd",
        id: "ch_fixture",
        metadata: options.id ? { transactionId: options.id } : {},
        paid: true,
        payment_intent: intent,
      });
    }
    if (path === "/checkout/sessions") {
      expect(params.get("payment_intent")).toBe(intent);
      return Promise.resolve({
        data:
          options.id || options.withoutMetadata
            ? [
                {
                  id: "cs_fixture",
                  payment_intent: options.sessionIntent ?? intent,
                },
              ]
            : [],
        has_more: false,
      });
    }
    if (path.startsWith("/refunds/")) {
      return Promise.resolve(
        refunds.find((entry) => entry.id === path.slice(9))
      );
    }
    expect(path).toBe("/refunds");
    expect(params.get("charge")).toBe("ch_fixture");
    if (options.paginate && !params.get("starting_after")) {
      return Promise.resolve({ data: refunds.slice(0, 1), has_more: true });
    }
    return Promise.resolve({
      data: options.paginate ? refunds.slice(1) : refunds,
      has_more: false,
    });
  });
}

// Shape follows Stripe's published Refund object; all identifiers are synthetic.
function refund(
  intent: string,
  id: string,
  amount: number,
  status = "succeeded"
) {
  return {
    amount,
    charge: "ch_fixture",
    currency: "usd",
    id,
    object: "refund",
    payment_intent: intent,
    reason: null,
    status,
  };
}
const sync = (db: TestDb) =>
  syncConfirmedStripeRefunds({
    db,
    eventType: "charge.refunded",
    id: "ch_fixture",
  });
const facts = (db: TestDb, id: string) =>
  db.select().from(paymentRefunds).where(eq(paymentRefunds.transactionId, id));
const statusOf = async (db: TestDb, id: string) => {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id));
  return rows[0]?.status;
};

describe.skipIf(!local)("confirmed Stripe refund persistence", () => {
  it("records actual partial refund IDs and amounts, idempotently", async () => {
    await fixture(async (db, id, intent) => {
      provider(intent, [refund(intent, "re_partial", 300)]);
      expect(await sync(db)).toEqual({ fullRefund: false, recorded: 1 });
      expect(await sync(db)).toEqual({ fullRefund: false, recorded: 0 });
      expect(await facts(db, id)).toMatchObject([
        { amountCents: 300, stripeRefundId: "re_partial" },
      ]);
      expect(await statusOf(db, id)).toBe("succeeded");
    });
  });
  it("paginates all refunds and marks full only when their confirmed sum covers the charge", async () => {
    await fixture(async (db, id, intent) => {
      provider(
        intent,
        [refund(intent, "re_first", 300), refund(intent, "re_second", 700)],
        { paginate: true }
      );
      expect(await sync(db)).toEqual({ fullRefund: true, recorded: 2 });
      expect(await facts(db, id)).toHaveLength(2);
      expect(await statusOf(db, id)).toBe("refunded");
      expect(
        request.mock.calls.some(
          ([input]) => input.params?.get("starting_after") === "re_first"
        )
      ).toBe(true);
    });
  });
  it.each(["pending", "requires_action", "failed", "canceled"])(
    "does not record %s refunds as money",
    async (state) => {
      await fixture(async (db, id, intent) => {
        provider(intent, [refund(intent, "re_unconfirmed", 1000, state)]);
        expect(await sync(db)).toEqual({ fullRefund: false, recorded: 0 });
        expect(await facts(db, id)).toHaveLength(0);
        expect(await statusOf(db, id)).toBe("succeeded");
      });
    }
  );
  it("handles a delayed refund event using current successful provider state", async () => {
    await fixture(async (db, id, intent) => {
      provider(intent, [refund(intent, "re_current", 1000)]);
      expect(
        await syncConfirmedStripeRefunds({
          connectedAccountId: "acct_fixture",
          db,
          eventType: "refund.updated",
          id: "re_current",
        })
      ).toEqual({ fullRefund: true, recorded: 1 });
      expect(
        request.mock.calls.every(
          ([input]) => input.connectedAccountId === "acct_fixture"
        )
      ).toBe(true);
      expect(await statusOf(db, id)).toBe("refunded");
    });
  });
  it("verifies Checkout ownership when refund arrives before the settlement event", async () => {
    await fixture(async (db, id, intent) => {
      provider(intent, [refund(intent, "re_early", 1000)], { id });
      expect(await sync(db)).toEqual({ fullRefund: true, recorded: 1 });
      expect(await statusOf(db, id)).toBe("refunded");
      expect(await facts(db, id)).toHaveLength(1);
    }, true);
  });
  it("resolves an early refund without relying on copied charge metadata", async () => {
    await fixture(async (db, id, intent) => {
      provider(intent, [refund(intent, "re_no_metadata", 1000)], {
        withoutMetadata: true,
      });
      expect(await sync(db)).toEqual({ fullRefund: true, recorded: 1 });
      expect(await statusOf(db, id)).toBe("refunded");
    }, true);
  });
  it("rejects metadata pointing at another Checkout Session without writing facts", async () => {
    await fixture(async (db, id, intent) => {
      provider(intent, [refund(intent, "re_wrong", 1000)], {
        id,
        sessionIntent: "pi_other",
      });
      await expect(sync(db)).rejects.toThrow(/does not own/u);
      expect(await facts(db, id)).toHaveLength(0);
      expect(await statusOf(db, id)).toBe("pending");
    }, true);
  });
  it("rolls back all writes when an existing refund fact contradicts Stripe", async () => {
    await fixture(async (db, id, intent) => {
      await db.insert(paymentRefunds).values({
        amountCents: 500,
        id: randomUUID(),
        stripeRefundId: "re_conflict",
        transactionId: id,
      });
      provider(intent, [
        refund(intent, "re_new", 300),
        refund(intent, "re_conflict", 700),
      ]);
      await expect(sync(db)).rejects.toThrow(/conflicts/u);
      expect(await facts(db, id)).toHaveLength(1);
      expect(await statusOf(db, id)).toBe("succeeded");
    });
  });
  it("keeps legacy charge-shaped records separate from new confirmed facts", async () => {
    await fixture(async (db, id, intent) => {
      await db.insert(paymentRefunds).values({
        amountCents: 1000,
        id: randomUUID(),
        stripeRefundId: "ch_legacy",
        transactionId: id,
      });
      provider(intent, [refund(intent, "re_actual", 300)]);
      expect(await sync(db)).toEqual({ fullRefund: false, recorded: 1 });
      expect(await facts(db, id)).toHaveLength(2);
      expect(await statusOf(db, id)).toBe("succeeded");
    });
  });
  it("surfaces later bank failure without silently deleting a prior refund fact", async () => {
    await fixture(async (db, id, intent) => {
      provider(intent, [refund(intent, "re_later_failure", 300)]);
      await sync(db);
      provider(intent, [refund(intent, "re_later_failure", 300, "failed")]);
      await expect(sync(db)).rejects.toThrow(/manual reconciliation/u);
      expect(await facts(db, id)).toHaveLength(1);
    });
  });
  it.each([
    { amount: 1200 },
    { currency: "eur" },
    { charge: "ch_other" },
    { payment_intent: "pi_other" },
  ])(
    "rejects inconsistent refund facts before recording: %j",
    async (invalid) => {
      await fixture(async (db, id, intent) => {
        provider(intent, [
          { ...refund(intent, "re_invalid", 1000), ...invalid },
        ]);
        await expect(sync(db)).rejects.toThrow();
        expect(await facts(db, id)).toHaveLength(0);
      });
    }
  );
  it("rejects a non-advancing provider pagination cursor", async () => {
    await fixture(async (db, id, intent) => {
      const entry = refund(intent, "re_stuck", 100);
      provider(intent, [entry]);
      const normal = request.getMockImplementation();
      request.mockImplementation((input) =>
        input.path === "/refunds"
          ? Promise.resolve({ data: [entry], has_more: true })
          : normal?.(input)
      );
      await expect(sync(db)).rejects.toThrow(/pagination/u);
      expect(await facts(db, id)).toHaveLength(0);
    });
  });
  it("does not change database state when the provider read fails", async () => {
    await fixture(async (db, id, intent) => {
      provider(intent, [], { unavailable: true });
      await expect(sync(db)).rejects.toThrow(/unavailable/u);
      expect(await facts(db, id)).toHaveLength(0);
    });
  });
});
