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
    select.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    update.mockReturnValue({ set });
    await processStripeEvent({
      event: {
        data: { object: { ...payment, metadata: { transactionId: "dummy" } } },
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
});
