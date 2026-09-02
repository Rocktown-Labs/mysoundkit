import { describe, expect, it } from "vitest";

import {
  COLLABORATOR_CREDIT_ROLES,
  DEFAULT_COLLABORATOR_CREDIT_ROLE,
  isCollaboratorCreditRole,
} from "./collaborator-credits";

describe("collaborator credit roles", () => {
  it("defaults new credit entries to artist", () => {
    expect(DEFAULT_COLLABORATOR_CREDIT_ROLE).toBe("artist");
  });

  it("supports the artist, writer, and producer choices", () => {
    expect(COLLABORATOR_CREDIT_ROLES).toEqual([
      "artist",
      "songwriter",
      "producer",
    ]);
    expect(isCollaboratorCreditRole("artist")).toBe(true);
    expect(isCollaboratorCreditRole("songwriter")).toBe(true);
    expect(isCollaboratorCreditRole("producer")).toBe(true);
    expect(isCollaboratorCreditRole("manager")).toBe(false);
  });
});
