import { env } from "@soundkit/env/server";

const getEnvValue = (key: string) =>
    (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "",
  checkoutIntegrationIdentifier = () => {
    const suffix = Array.from(
      crypto.getRandomValues(new Uint8Array(8)),
      (value) => String.fromCharCode(97 + (value % 26))
    ).join("");
    return `soundkit_${suffix}`;
  },
  appendValue = (
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
  idempotencyKey,
  method = "POST",
  params,
  path,
}: {
  connectedAccountId?: string;
  idempotencyKey?: string;
  method?: "GET" | "POST" | "DELETE";
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

  if (idempotencyKey && method === "POST") {
    headers.set("Idempotency-Key", idempotencyKey);
  }

  if (connectedAccountId) {
    headers.set("Stripe-Account", connectedAccountId);
  }

  const query = method === "GET" && params ? `?${params.toString()}` : "",
    response = await fetch(`https://api.stripe.com/v1${path}${query}`, {
      body: method === "POST" ? (params ? params.toString() : "") : undefined,
      headers,
      method,
    }),
    responseBody = await response.text();

  if (!response.ok) {
    let detail = responseBody.slice(0, 300);
    try {
      const parsed = JSON.parse(responseBody) as {
        error?: { code?: string; message?: string; type?: string };
      };
      detail = JSON.stringify(parsed.error ?? parsed).slice(0, 300);
    } catch {
      // Keep the bounded raw response when Stripe does not return JSON.
    }

    const requestId = response.headers.get("request-id");
    throw new Error(
      `Stripe request failed with ${response.status}${
        requestId ? ` (request ${requestId})` : ""
      }: ${detail}`
    );
  }

  return JSON.parse(responseBody) as T;
};

export interface StripeListResponse<T> {
  data: T[];
  has_more: boolean;
}

export interface StripeProductSummary {
  active: boolean;
  id: string;
  metadata?: Record<string, string>;
  name: string;
}

export interface StripeWebhookEndpointSummary {
  api_version?: string | null;
  connect?: boolean;
  enabled_events?: string[];
  id: string;
  secret?: string | null;
  status: "disabled" | "enabled";
  url: string;
}

export interface StripePriceSummary {
  active: boolean;
  currency: string;
  id: string;
  lookup_key?: string | null;
  metadata?: Record<string, string>;
  nickname?: string | null;
  product: string | StripeProductSummary;
  recurring?: {
    interval?: "day" | "month" | "week" | "year";
  } | null;
  unit_amount?: number | null;
}

export const listStripeProducts = () => {
  const params = new URLSearchParams();
  appendValue(params, "active", true);
  appendValue(params, "limit", 100);

  return stripeRequest<StripeListResponse<StripeProductSummary>>({
    method: "GET",
    params,
    path: "/products",
  });
};

export const listStripePrices = () => {
  const params = new URLSearchParams();
  appendValue(params, "active", true);
  appendValue(params, "expand[]", "data.product");
  appendValue(params, "limit", 100);

  return stripeRequest<StripeListResponse<StripePriceSummary>>({
    method: "GET",
    params,
    path: "/prices",
  });
};

export const listStripeWebhookEndpoints = () => {
  const params = new URLSearchParams();
  appendValue(params, "limit", 100);

  return stripeRequest<StripeListResponse<StripeWebhookEndpointSummary>>({
    method: "GET",
    params,
    path: "/webhook_endpoints",
  });
};

export const createStripeWebhookEndpoint = ({
  connect = false,
  enabledEvents,
  url,
}: {
  connect?: boolean;
  enabledEvents: string[];
  url: string;
}) => {
  const params = new URLSearchParams();
  appendValue(params, "connect", connect);
  appendValue(params, "url", url);
  for (const event of enabledEvents) {
    appendValue(params, "enabled_events[]", event);
  }

  return stripeRequest<StripeWebhookEndpointSummary>({
    params,
    path: "/webhook_endpoints",
  });
};

export const retrieveStripePrice = (priceId: string) => {
  const params = new URLSearchParams();
  appendValue(params, "expand[]", "product");

  return stripeRequest<StripePriceSummary>({
    method: "GET",
    params,
    path: `/prices/${encodeURIComponent(priceId)}`,
  });
};

export const createStripeProduct = ({
  code,
  description,
  name,
}: {
  code: string;
  description?: string;
  name: string;
}) => {
  const params = new URLSearchParams();
  appendValue(params, "name", name);
  if (description) {
    appendValue(params, "description", description);
  }
  appendValue(params, "metadata[soundkit_plan_code]", code);

  return stripeRequest<StripeProductSummary>({
    params,
    path: "/products",
  });
};

export const createStripeRecurringPrice = ({
  amountCents,
  code,
  currency = "usd",
  interval,
  productId,
}: {
  amountCents: number;
  code: string;
  currency?: string;
  interval: "month" | "year";
  productId: string;
}) => {
  const params = new URLSearchParams();
  appendValue(params, "currency", currency);
  appendValue(params, "lookup_key", `${code}_${interval}`);
  appendValue(params, "metadata[soundkit_interval]", interval);
  appendValue(params, "metadata[soundkit_plan_code]", code);
  appendValue(params, "product", productId);
  appendValue(params, "recurring[interval]", interval);
  appendValue(params, "transfer_lookup_key", true);
  appendValue(params, "unit_amount", amountCents);

  return stripeRequest<StripePriceSummary>({
    params,
    path: "/prices",
  });
};

export interface StripeCouponSummary {
  amount_off?: number | null;
  applies_to?: { products?: string[] } | null;
  currency?: string | null;
  duration: "once" | "repeating" | "forever";
  duration_in_months?: number | null;
  id: string;
  max_redemptions?: number | null;
  metadata?: Record<string, string> | null;
  name?: string | null;
  percent_off?: number | null;
  redeem_by?: number | null;
  times_redeemed?: number;
  valid: boolean;
}

export interface StripePromotionCodeSummary {
  active: boolean;
  code: string;
  created: number;
  expires_at?: number | null;
  id: string;
  max_redemptions?: number | null;
  promotion: {
    coupon: string | StripeCouponSummary;
    type: "coupon";
  };
  times_redeemed: number;
}

export const listStripePromotionCodes = () => {
  const params = new URLSearchParams();
  appendValue(params, "active", true);
  appendValue(params, "expand[]", "data.promotion.coupon");
  appendValue(params, "limit", 100);

  return stripeRequest<StripeListResponse<StripePromotionCodeSummary>>({
    method: "GET",
    params,
    path: "/promotion_codes",
  });
};

export const createStripeCoupon = ({
  amountOff,
  appliesToProducts,
  currency = "usd",
  duration = "once",
  durationInMonths,
  id,
  maxRedemptions,
  metadata,
  name,
  percentOff,
  redeemBy,
}: {
  amountOff?: number;
  appliesToProducts?: string[];
  currency?: string;
  duration?: "once" | "repeating" | "forever";
  durationInMonths?: number;
  id?: string;
  maxRedemptions?: number;
  metadata?: Record<string, string>;
  name?: string;
  percentOff?: number;
  redeemBy?: number;
}) => {
  const params = new URLSearchParams();
  appendValue(params, "duration", duration);
  if (id) {
    appendValue(params, "id", id);
  }
  if (name) {
    appendValue(params, "name", name);
  }
  if (percentOff) {
    appendValue(params, "percent_off", percentOff);
  }
  if (amountOff) {
    appendValue(params, "amount_off", amountOff);
    appendValue(params, "currency", currency);
  }
  if (duration === "repeating" && durationInMonths) {
    appendValue(params, "duration_in_months", durationInMonths);
  }
  if (maxRedemptions) {
    appendValue(params, "max_redemptions", maxRedemptions);
  }
  if (redeemBy) {
    appendValue(params, "redeem_by", redeemBy);
  }
  if (appliesToProducts && appliesToProducts.length > 0) {
    for (const [index, prodId] of appliesToProducts.entries()) {
      appendValue(params, `applies_to[products][${index}]`, prodId);
    }
  }
  if (metadata) {
    for (const [key, val] of Object.entries(metadata)) {
      appendValue(params, `metadata[${key}]`, val);
    }
  }

  return stripeRequest<StripeCouponSummary>({
    params,
    path: "/coupons",
  });
};

export const createStripePromotionCode = ({
  code,
  couponId,
  maxRedemptions,
}: {
  code: string;
  couponId: string;
  maxRedemptions?: number;
}) => {
  const params = new URLSearchParams();
  appendValue(params, "promotion[type]", "coupon");
  appendValue(params, "promotion[coupon]", couponId);
  appendValue(params, "code", code);
  appendValue(params, "max_redemptions", maxRedemptions);

  return stripeRequest<StripePromotionCodeSummary>({
    params,
    path: "/promotion_codes",
  });
};

export const archiveStripePromotionCode = (promotionCodeId: string) => {
  const params = new URLSearchParams();
  appendValue(params, "active", false);
  return stripeRequest<StripePromotionCodeSummary>({
    params,
    path: `/promotion_codes/${encodeURIComponent(promotionCodeId)}`,
  });
};

export const retrieveStripeCharge = (chargeId: string) =>
  stripeRequest<{
    id: string;
    metadata?: Record<string, string>;
    transfer?: string | null;
  }>({
    method: "GET",
    path: `/charges/${encodeURIComponent(chargeId)}`,
  });

export const reverseStripeTransfer = (transferId: string) =>
  stripeRequest<{ id: string }>({
    params: new URLSearchParams(),
    path: `/transfers/${encodeURIComponent(transferId)}/reversals`,
  });

interface CheckoutLineItem {
  currency: string;
  name: string;
  priceCents: number;
  quantity: number;
}

interface CreateCheckoutSessionInput {
  applicationFeeCents?: number;
  cancelUrl?: string;
  connectedAccountId?: string;
  customerEmail?: string | null;
  destinationAccountId?: string;
  embedded?: boolean;
  lineItems: CheckoutLineItem[];
  metadata: Record<string, string>;
  returnUrl?: string;
  successUrl?: string;
  transferGroup?: string;
}

export const buildCheckoutSessionParams = ({
  applicationFeeCents,
  cancelUrl,
  customerEmail,
  destinationAccountId,
  embedded = false,
  lineItems,
  metadata,
  returnUrl,
  successUrl,
  transferGroup,
}: CreateCheckoutSessionInput) => {
  const params = new URLSearchParams();
  appendValue(params, "mode", "payment");
  appendValue(
    params,
    "integration_identifier",
    checkoutIntegrationIdentifier()
  );
  appendValue(params, "allow_promotion_codes", true);
  appendValue(params, "customer_email", customerEmail);

  if (embedded) {
    appendValue(params, "ui_mode", "embedded");
    appendValue(params, "return_url", returnUrl ?? successUrl);
  } else {
    appendValue(params, "success_url", successUrl);
    appendValue(params, "cancel_url", cancelUrl);
  }

  if (destinationAccountId) {
    appendValue(
      params,
      "payment_intent_data[application_fee_amount]",
      applicationFeeCents
    );
    appendValue(
      params,
      "payment_intent_data[transfer_data][destination]",
      destinationAccountId
    );
  }

  appendValue(params, "payment_intent_data[transfer_group]", transferGroup);

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

  return params;
};

const createCheckoutSession = (input: CreateCheckoutSessionInput) =>
  stripeRequest<{
    client_secret?: string | null;
    id: string;
    url: string | null;
  }>({
    connectedAccountId: input.connectedAccountId,
    idempotencyKey: input.metadata.transactionId
      ? `checkout:${input.metadata.transactionId}`
      : undefined,
    params: buildCheckoutSessionParams(input),
    path: "/checkout/sessions",
  });

export const createDestinationCheckout = ({
  applicationFeeCents,
  cancelUrl,
  destinationAccountId,
  customerEmail,
  lineItems,
  metadata,
  successUrl,
}: {
  applicationFeeCents: number;
  cancelUrl: string;
  customerEmail?: string | null;
  destinationAccountId: string;
  lineItems: CheckoutLineItem[];
  metadata: Record<string, string>;
  successUrl: string;
}) =>
  createCheckoutSession({
    applicationFeeCents,
    cancelUrl,
    customerEmail,
    destinationAccountId,
    lineItems,
    metadata,
    successUrl,
  });

export const createEmbeddedTipCheckout = ({
  applicationFeeCents,
  cancelUrl,
  customerEmail,
  destinationAccountId,
  lineItems,
  metadata,
  returnUrl,
}: {
  applicationFeeCents?: number;
  cancelUrl: string;
  customerEmail?: string | null;
  destinationAccountId?: string;
  lineItems: CheckoutLineItem[];
  metadata: Record<string, string>;
  returnUrl: string;
}) =>
  createCheckoutSession({
    applicationFeeCents,
    cancelUrl,
    customerEmail,
    destinationAccountId,
    embedded: true,
    lineItems,
    metadata,
    returnUrl,
    transferGroup: metadata.transactionId,
  });

export const retrieveCheckoutSession = async (
  sessionId: string
): Promise<{
  client_secret?: string | null;
  id: string;
  status?: string;
  url: string | null;
} | null> =>
  stripeRequest({
    method: "GET",
    path: `/checkout/sessions/${sessionId}`,
  });

export const executeSellerTransfer = async ({
  amountCents,
  destinationAccountId,
  idempotencyKey,
}: {
  amountCents: number;
  destinationAccountId: string;
  idempotencyKey?: string;
}): Promise<string | null> => {
  if (amountCents <= 0) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("amount", String(amountCents));
  params.set("currency", "usd");
  params.set("destination", destinationAccountId);

  const transfer = await stripeRequest<{ id: string }>({
    idempotencyKey:
      idempotencyKey ??
      `payout:${destinationAccountId}:${amountCents}:${new Date().toISOString().slice(0, 10)}`,
    params,
    path: "/transfers",
  });

  return transfer?.id ?? null;
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
  appendValue(
    params,
    "integration_identifier",
    checkoutIntegrationIdentifier()
  );
  appendValue(params, "allow_promotion_codes", true);
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

export const verifyStripeSignatureWithSecrets = async ({
  payload,
  secrets,
  signature,
}: {
  payload: string;
  secrets: string[];
  signature: string | null;
}) => {
  for (const secret of secrets.filter(Boolean)) {
    if (await verifyStripeSignature({ payload, secret, signature })) {
      return true;
    }
  }
  return false;
};

export const verifyStripeSignature = async ({
  payload,
  secret,
  signature,
}: {
  payload: string;
  secret?: string;
  signature: string | null;
}) => {
  const webhookSecret = secret || getEnvValue("STRIPE_COMMERCE_WEBHOOK_SECRET");

  if (!(webhookSecret && signature)) {
    return false;
  }

  const parts = Object.fromEntries(
      signature.split(",").map((part) => part.split("=", 2))
    ),
    timestamp = parts.t,
    expected = parts.v1;

  if (!(timestamp && expected)) {
    return false;
  }

  const timestampSeconds = Number(timestamp),
    toleranceSeconds = 5 * 60;

  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > toleranceSeconds
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(webhookSecret),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["verify"]
    ),
    expectedBytes = hexToBytes(expected);

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
