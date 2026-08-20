import { describe, expect, it } from "vitest";

import { verifyStripeSignatureWithSecrets } from "./stripe";

const signatureFor = async (
  payload: string,
  secret: string,
  timestamp: number
) => {
  const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["sign"]
    ),
    digest = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${payload}`)
    );
  return `t=${timestamp},v1=${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

describe("Stripe webhook signing secrets", () => {
  it("accepts a signature from any configured endpoint secret", async () => {
    const payload = JSON.stringify({ id: "evt_test" }),
      timestamp = Math.floor(Date.now() / 1000),
      signature = await signatureFor(payload, "commerce-secret", timestamp);

    await expect(
      verifyStripeSignatureWithSecrets({
        payload,
        secrets: ["better-auth-secret", "commerce-secret"],
        signature,
      })
    ).resolves.toBe(true);
  });

  it("rejects signatures that do not match any configured secret", async () => {
    const payload = JSON.stringify({ id: "evt_test" }),
      timestamp = Math.floor(Date.now() / 1000),
      signature = await signatureFor(payload, "wrong-secret", timestamp);

    await expect(
      verifyStripeSignatureWithSecrets({
        payload,
        secrets: ["better-auth-secret", "commerce-secret"],
        signature,
      })
    ).resolves.toBe(false);
  });
});
