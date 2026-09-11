import { describe, expect, it, vi } from "vitest";

const poolState = vi.hoisted(() => ({
  options: null as Record<string, unknown> | null,
}));

vi.mock("pg", () => ({
  Pool: vi.fn(function MockPool(options: Record<string, unknown>) {
    poolState.options = options;
  }),
}));

describe("database pool", () => {
  it("keeps Hyperdrive clients reusable between queries", async () => {
    process.env.DATABASE_URL =
      "postgres://soundkit_test:soundkit_test@127.0.0.1:5432/soundkit_test";

    const { createDb } = await import("./index");
    createDb();

    expect(poolState.options).toMatchObject({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
    expect(poolState.options).not.toHaveProperty("maxUses");
  });
});
