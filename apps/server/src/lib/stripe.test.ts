import { describe, expect, it } from "vitest";

import {
  buildCheckoutSessionParams,
  verifyStripeSignatureWithSecrets,
} from "./stripe";

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

describe("Stripe Checkout parameters", () => {
  it("uses the platform account for destination charges", () => {
    const params = buildCheckoutSessionParams({
      applicationFeeCents: 100,
      cancelUrl: "https://soundkit.test/cancel",
      customerEmail: "fan@example.com",
      destinationAccountId: "acct_artist",
      lineItems: [
        {
          currency: "USD",
          name: "Artist tip",
          priceCents: 1000,
          quantity: 1,
        },
      ],
      metadata: { transactionId: "transaction_123" },
      successUrl: "https://soundkit.test/success",
    });

    expect(params.get("payment_intent_data[transfer_data][destination]")).toBe(
      "acct_artist"
    );
    expect(params.get("payment_intent_data[application_fee_amount]")).toBe(
      "100"
    );
    expect(params.get("managed_payments[enabled]")).toBe("false");
    expect(params.get("success_url")).toBe("https://soundkit.test/success");
    expect(params.get("ui_mode")).toBeNull();
  });

  it("uses return_url for embedded destination charges", () => {
    const params = buildCheckoutSessionParams({
      applicationFeeCents: 100,
      destinationAccountId: "acct_artist",
      embedded: true,
      lineItems: [
        {
          currency: "USD",
          name: "Artist tip",
          priceCents: 1000,
          quantity: 1,
        },
      ],
      metadata: { transactionId: "transaction_123" },
      returnUrl: "https://soundkit.test/live",
    });

    expect(params.get("ui_mode")).toBe("embedded");
    expect(params.get("return_url")).toBe("https://soundkit.test/live");
    expect(params.get("managed_payments[enabled]")).toBe("false");
    expect(params.get("success_url")).toBeNull();
    expect(params.get("payment_intent_data[transfer_data][destination]")).toBe(
      "acct_artist"
    );
  });

  it("can explicitly disable Managed Payments for platform tip charges", () => {
    const params = buildCheckoutSessionParams({
      embedded: true,
      lineItems: [
        {
          currency: "USD",
          name: "Battle tip",
          priceCents: 1000,
          quantity: 1,
        },
      ],
      managedPaymentsEnabled: false,
      metadata: { transactionId: "transaction_123" },
      returnUrl: "https://soundkit.test/live",
    });

    expect(params.get("managed_payments[enabled]")).toBe("false");
  });

  it("serializes shipping options and address collection for physical merch checkouts", () => {
    const params = buildCheckoutSessionParams({
      applicationFeeCents: 950,
      cancelUrl: "https://soundkit.test/cart",
      collectShippingAddress: true,
      destinationAccountId: "acct_artist",
      lineItems: [
        {
          currency: "USD",
          name: "Audio CD",
          priceCents: 1500,
          quantity: 1,
        },
      ],
      metadata: { transactionId: "transaction_physical_1" },
      shippingOptions: [
        {
          amountCents: 500,
          currency: "USD",
          deliveryEstimate: {
            maximum: { unit: "business_day", value: 5 },
            minimum: { unit: "business_day", value: 3 },
          },
          displayName: "USPS First Class Mail",
        },
      ],
      successUrl: "https://soundkit.test/order/complete",
    });

    expect(params.get("shipping_options[0][shipping_rate_data][type]")).toBe(
      "fixed_amount"
    );
    expect(
      params.get("shipping_options[0][shipping_rate_data][display_name]")
    ).toBe("USPS First Class Mail");
    expect(
      params.get(
        "shipping_options[0][shipping_rate_data][fixed_amount][amount]"
      )
    ).toBe("500");
    expect(
      params.get(
        "shipping_options[0][shipping_rate_data][fixed_amount][currency]"
      )
    ).toBe("usd");
    expect(
      params.get(
        "shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]"
      )
    ).toBe("business_day");
    expect(
      params.get(
        "shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]"
      )
    ).toBe("3");
    expect(params.get("payment_intent_data[application_fee_amount]")).toBe(
      "950"
    );
  });
});

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
