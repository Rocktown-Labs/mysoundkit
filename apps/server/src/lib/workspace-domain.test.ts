import { describe, expect, it } from "vitest";

import { canManageWorkspace, hasWorkspaceCapacity } from "./workspace-domain";

describe("workspace access boundaries", () => {
  it("only allows owner and admin to manage members", () => {
    expect(canManageWorkspace("owner")).toBe(true);
    expect(canManageWorkspace("admin")).toBe(true);
    expect(canManageWorkspace("member")).toBe(false);
    expect(canManageWorkspace(undefined)).toBe(false);
  });

  it("counts pending invitations against available seats", () => {
    expect(
      hasWorkspaceCapacity({
        memberCount: 1,
        pendingInvitationCount: 1,
        totalSeats: 2,
      })
    ).toBe(false);
    expect(
      hasWorkspaceCapacity({
        memberCount: 1,
        pendingInvitationCount: 0,
        totalSeats: 2,
      })
    ).toBe(true);
  });
});
