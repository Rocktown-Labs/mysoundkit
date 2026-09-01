import { getPreferredRecipientName } from "@soundkit/transactional/recipient-name";
import { describe, expect, it } from "vitest";

describe("getPreferredRecipientName", () => {
  it("prefers a platform username and removes its mention prefix", () => {
    expect(
      getPreferredRecipientName({
        email: "mxalvis@rocktownlabs.com",
        name: "Matt Alvis",
        username: "@alphamane",
      })
    ).toBe("alphamane");
  });

  it("uses the first name when a username is unavailable", () => {
    expect(
      getPreferredRecipientName({
        email: "cg@rocktownlabs.com",
        name: "CG Stewart",
      })
    ).toBe("CG");
  });

  it("does not use the email local-part as a greeting", () => {
    expect(
      getPreferredRecipientName({
        email: "cg@rocktownlabs.com",
        name: "cg",
      })
    ).toBe("there");
  });

  it("uses a generic greeting when identity data is missing", () => {
    expect(getPreferredRecipientName({})).toBe("there");
  });
});
