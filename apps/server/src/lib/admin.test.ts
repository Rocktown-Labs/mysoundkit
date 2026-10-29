import { describe, expect, it, vi } from "vitest";

import { isAdminUser } from "./admin";

vi.mock("@soundkit/env/server", () => ({
  env: { ADMIN_EMAILS: "admin@example.invalid" },
}));

describe("administrator authorization", () => {
  it("rejects an allowlisted ordinary account until email ownership is verified", () => {
    const user = { email: "admin@example.invalid", id: "dummy", role: "user" };
    expect(isAdminUser(user)).toBe(false);
    expect(isAdminUser({ ...user, emailVerified: false })).toBe(false);
    expect(isAdminUser({ ...user, emailVerified: true })).toBe(true);
    expect(
      isAdminUser({
        ...user,
        email: "other@example.invalid",
        emailVerified: true,
      })
    ).toBe(false);
  });

  it("preserves trusted role authorization without trusting an email claim", () => {
    expect(isAdminUser({ id: "dummy", role: "user, admin" })).toBe(true);
    expect(isAdminUser(null)).toBe(false);
  });
});
