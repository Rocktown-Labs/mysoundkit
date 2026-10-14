import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyPrintfulWebhookSignature } from "./webhooks-printful";

const rawSecret = new TextEncoder().encode("test-webhook-secret"),
  hexSecret = [...rawSecret]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(""),
  createHmacSignature = async (
    payload: string,
    keyBytes: Uint8Array
  ): Promise<string> => {
    const key = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { hash: "SHA-256", name: "HMAC" },
        false,
        ["sign"]
      ),
      signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(payload)
      );

    return [...new Uint8Array(signature)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

describe("Printful webhook signature verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies a correctly signed payload", async () => {
    const payload =
        '{"type":"shipment_sent","data":{"order":{"external_id":"test-123"}}}',
      signature = await createHmacSignature(payload, rawSecret);

    expect(
      await verifyPrintfulWebhookSignature({
        payload,
        secretKey: hexSecret,
        signature,
      })
    ).toBe(true);
  });

  it("rejects an incorrectly signed payload", async () => {
    const payload = '{"type":"shipment_sent","data":{}}',
      signature = await createHmacSignature("tampered", rawSecret);

    expect(
      await verifyPrintfulWebhookSignature({
        payload,
        secretKey: hexSecret,
        signature,
      })
    ).toBe(false);
  });

  it("rejects a missing signature", async () => {
    expect(
      await verifyPrintfulWebhookSignature({
        payload: "{}",
        secretKey: hexSecret,
        signature: null,
      })
    ).toBe(false);
  });
});
