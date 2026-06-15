import { env } from "@soundkit/env/server";

const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

const appendValue = (
  params: URLSearchParams,
  key: string,
  value: boolean | number | string | null | undefined
) => {
  if (value !== null && value !== undefined) {
    params.append(key, String(value));
  }
};

export const stripeRequest = async <T>({
  connectedAccountId,
  params,
  path,
}: {
  connectedAccountId?: string;
  params?: URLSearchParams;
  path: string;
}): Promise<T | null> => {
  const secretKey = getEnvValue("STRIPE_SECRET_KEY");

  if (!secretKey) {
    return null;
  }

  const headers = new Headers({
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  });

  if (connectedAccountId) {
    headers.set("Stripe-Account", connectedAccountId);
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    body: params,
    headers,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Stripe request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
};

export const createDestinationCheckout = ({
  applicationFeeCents,
  cancelUrl,
  connectedAccountId,
  customerEmail,
  lineItems,
  metadata,
  successUrl,
}: {
  applicationFeeCents: number;
  cancelUrl: string;
  connectedAccountId: string;
  customerEmail?: string | null;
  lineItems: {
    currency: string;
    name: string;
    priceCents: number;
    quantity: number;
  }[];
  metadata: Record<string, string>;
  successUrl: string;
}) => {
  const params = new URLSearchParams();
  appendValue(params, "mode", "payment");
  appendValue(params, "success_url", successUrl);
  appendValue(params, "cancel_url", cancelUrl);
  appendValue(params, "customer_email", customerEmail);
  appendValue(
    params,
    "payment_intent_data[application_fee_amount]",
    applicationFeeCents
  );
  appendValue(
    params,
    "payment_intent_data[transfer_data][destination]",
    connectedAccountId
  );

  for (const [key, value] of Object.entries(metadata)) {
    appendValue(params, `metadata[${key}]`, value);
    appendValue(params, `payment_intent_data[metadata][${key}]`, value);
  }

  for (const [index, item] of lineItems.entries()) {
    appendValue(params, `line_items[${index}][quantity]`, item.quantity);
    appendValue(
      params,
      `line_items[${index}][price_data][currency]`,
      item.currency.toLowerCase()
    );
    appendValue(
      params,
      `line_items[${index}][price_data][unit_amount]`,
      item.priceCents
    );
    appendValue(
      params,
      `line_items[${index}][price_data][product_data][name]`,
      item.name
    );
  }

  return stripeRequest<{ id: string; url: string | null }>({
    params,
    path: "/checkout/sessions",
  });
};

export const createConnectedSubscriptionCheckout = ({
  applicationFeePercent,
  cancelUrl,
  connectedAccountId,
  currency,
  customerEmail,
  metadata,
  monthlyPriceCents,
  name,
  successUrl,
}: {
  applicationFeePercent: number;
  cancelUrl: string;
  connectedAccountId: string;
  currency: string;
  customerEmail?: string | null;
  metadata: Record<string, string>;
  monthlyPriceCents: number;
  name: string;
  successUrl: string;
}) => {
  const params = new URLSearchParams();
  appendValue(params, "mode", "subscription");
  appendValue(params, "success_url", successUrl);
  appendValue(params, "cancel_url", cancelUrl);
  appendValue(params, "customer_email", customerEmail);
  appendValue(
    params,
    "subscription_data[application_fee_percent]",
    applicationFeePercent
  );
  appendValue(params, "line_items[0][quantity]", 1);
  appendValue(
    params,
    "line_items[0][price_data][currency]",
    currency.toLowerCase()
  );
  appendValue(
    params,
    "line_items[0][price_data][unit_amount]",
    monthlyPriceCents
  );
  appendValue(
    params,
    "line_items[0][price_data][recurring][interval]",
    "month"
  );
  appendValue(params, "line_items[0][price_data][product_data][name]", name);

  for (const [key, value] of Object.entries(metadata)) {
    appendValue(params, `metadata[${key}]`, value);
    appendValue(params, `subscription_data[metadata][${key}]`, value);
  }

  return stripeRequest<{ id: string; url: string | null }>({
    connectedAccountId,
    params,
    path: "/checkout/sessions",
  });
};

const hexToBytes = (value: string) => {
  if (!/^[\da-f]+$/i.test(value) || value.length % 2 !== 0) {
    return null;
  }

  return new Uint8Array(
    value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []
  );
};

export const verifyStripeSignature = async ({
  payload,
  signature,
}: {
  payload: string;
  signature: string | null;
}) => {
  const secret = getEnvValue("STRIPE_WEBHOOK_SECRET");

  if (!(secret && signature)) {
    return false;
  }

  const parts = Object.fromEntries(
    signature.split(",").map((part) => part.split("=", 2))
  );
  const timestamp = parts.t;
  const expected = parts.v1;

  if (!(timestamp && expected)) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  const toleranceSeconds = 5 * 60;

  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > toleranceSeconds
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["verify"]
  );
  const expectedBytes = hexToBytes(expected);

  if (!expectedBytes) {
    return false;
  }

  return crypto.subtle.verify(
    "HMAC",
    key,
    expectedBytes,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  );
};
