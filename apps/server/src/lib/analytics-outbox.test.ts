import { describe, expect, it } from "vitest";

import { serializeOutboxEvent } from "./analytics-outbox";
import type { OutboxRow } from "./analytics-outbox";

const row: OutboxRow = {
  cohort_day: "2026-10-30",
  environment: "production",
  event_type: "payment_succeeded",
  id: "11111111-1111-4111-8111-111111111111",
  occurred_at: "2026-11-01T00:00:00Z",
  properties: { amount_cents: 1999, currency: "USD", kind: "tip" },
  subject_id: "22222222-2222-4222-8222-222222222222",
};
describe("internal analytics export contract", () => {
  it("exports a fixed versioned contract with integer money", () => {
    expect(serializeOutboxEvent(row)).toEqual({
      amount_cents: 1999,
      cohort_day: "2026-10-30",
      currency: "USD",
      environment: "production",
      event_id: row.id,
      event_type: "payment_succeeded",
      kind: "tip",
      occurred_at: "2026-11-01T00:00:00.000Z",
      policy_version: "internal-v1",
      producer_version: "server-outbox-v1",
      schema_version: 1,
      subject_key: row.subject_id,
    });
  });
  it.each([
    { amount_cents: 19.99, currency: "USD" },
    { amount_cents: -1, currency: "USD" },
    { amount_cents: Number.MAX_SAFE_INTEGER + 1, currency: "USD" },
    { amount_cents: 100, currency: "usd" },
    { amount_cents: 100, currency: "USD", email: "private@example.test" },
    { amount_cents: 100, currency: "USD", kind: "arbitrary-private-id" },
  ])("rejects malformed money or unapproved dimensions %#", (properties) => {
    expect(() => serializeOutboxEvent({ ...row, properties })).toThrow();
  });
  it("never copies additional source/account/provider fields", () => {
    const source = {
      ...row,
      source_key: "secret-entity",
      token: "secret-token",
      user_id: "private-id",
    };
    expect(JSON.stringify(serializeOutboxEvent(source))).not.toMatch(
      /secret|private-id/u
    );
  });
  it("does not infer revenue from access or publication events", () => {
    expect(
      serializeOutboxEvent({
        ...row,
        event_type: "access_granted",
        properties: { kind: "subscription" },
      })
    ).toMatchObject({ amount_cents: 0, currency: "" });
  });
});
