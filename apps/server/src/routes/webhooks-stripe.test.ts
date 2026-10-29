import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { processStripeEvent } from "./webhooks-stripe";

const { select, update } = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@soundkit/db", () => ({
  createDb: () => ({ select, update }),
  isDatabaseConfigured: () => false,
}));

describe("Checkout settlement", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
  ])("does not mutate paid state for an unpaid %s event", async (type) => {
    await processStripeEvent({
      event: {
        data: {
          object: {
            metadata: {
              tipDelivery: "transfers",
              transactionId: "dummy-transaction",
            },
            payment_status: "unpaid",
          },
        },
        type,
      },
    });
    expect(select).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    { amount_total: 1000, payment_status: "paid" },
    { amount_total: 0, payment_status: "no_payment_required" },
  ])("fulfills settled or genuinely free sessions: %j", async (payment) => {
    const set = vi.fn(() => ({ where })),
      where = vi.fn().mockResolvedValue([]);
    select
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([{ id: "dummy" }]) }),
        }),
      })
      .mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      });
    update.mockReturnValue({ set });
    await processStripeEvent({
      event: {
        data: {
          object: {
            ...payment,
            id: "cs_dummy",
            metadata: { transactionId: "dummy" },
          },
        },
        type: "checkout.session.completed",
      },
    });
    expect(set).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "succeeded" })
    );
    expect(set).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: "paid" })
    );
  });

  it("rejects a nonzero session claiming no payment is required", async () => {
    await processStripeEvent({
      event: {
        data: {
          object: {
            amount_total: 100,
            metadata: { transactionId: "dummy" },
            payment_status: "no_payment_required",
          },
        },
        type: "checkout.session.completed",
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("does not grant paid state from metadata on an unrelated Checkout session", async () => {
    const matchSession = vi.fn((condition: SQL) => {
      expect(new PgDialect().sqlToQuery(condition).params).toEqual([
        "dummy",
        "unrelated-session",
      ]);
      return { limit: () => Promise.resolve([]) };
    });
    select.mockReturnValue({ from: () => ({ where: matchSession }) });
    await processStripeEvent({
      event: {
        data: {
          object: {
            id: "unrelated-session",
            metadata: { transactionId: "dummy" },
            payment_status: "paid",
          },
        },
        type: "checkout.session.completed",
      },
    });
    expect(update).not.toHaveBeenCalled();
    expect(matchSession).toHaveBeenCalledTimes(1);
  });

  it("binds delayed failures to their session and updates only pending states", async () => {
    const dialect = new PgDialect(),
      queryParams = (condition: SQL | undefined) => {
        if (!condition) {
          throw new Error("Missing state guard");
        }
        return dialect.sqlToQuery(condition).params;
      },
      selectWhere = vi.fn((_condition: SQL) => ({
        limit: () => Promise.resolve([{ id: "dummy" }]),
      })),
      set = vi.fn(() => ({ where })),
      where = vi.fn((_condition: SQL) => Promise.resolve([]));
    select.mockReturnValue({ from: () => ({ where: selectWhere }) });
    update.mockReturnValue({ set });
    await processStripeEvent({
      event: {
        data: {
          object: { id: "cs_dummy", metadata: { transactionId: "dummy" } },
        },
        type: "checkout.session.async_payment_failed",
      },
    });
    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenNthCalledWith(1, { status: "failed" });
    expect(set).toHaveBeenNthCalledWith(2, { status: "failed" });
    expect(queryParams(selectWhere.mock.calls[0]?.[0])).toEqual([
      "dummy",
      "cs_dummy",
      "pending",
      "failed",
    ]);
    expect(queryParams(where.mock.calls[0]?.[0])).toEqual([
      "dummy",
      "cs_dummy",
      "pending",
    ]);
    expect(queryParams(where.mock.calls[1]?.[0])).toEqual([
      "dummy",
      "checkout_pending",
    ]);
  });

  it("ignores a delayed failure with no matching pending or failed session", async () => {
    select.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    await processStripeEvent({
      event: {
        data: {
          object: { id: "stale-session", metadata: { transactionId: "dummy" } },
        },
        type: "checkout.session.async_payment_failed",
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([{ metadata: { transactionId: "dummy" } }, { id: "cs_dummy" }])(
    "requires both transaction and session identity for failure events: %j",
    async (object) => {
      await processStripeEvent({
        event: {
          data: { object },
          type: "checkout.session.async_payment_failed",
        },
      });
      expect(select).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    }
  );
});
