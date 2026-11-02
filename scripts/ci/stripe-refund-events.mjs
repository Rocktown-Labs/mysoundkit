/* oxlint-disable node/no-top-level-await, one-var, sort-vars -- Explicitly dispatched maintenance CLI. */
import { pathToFileURL } from "node:url";

export const refundEvents = [
  "charge.refunded",
  "charge.refund.updated",
  "refund.created",
  "refund.updated",
  "refund.failed",
];
const endpointUrl = "https://api.mysoundkit.com/v1/webhooks/stripe-commerce";

export async function syncRefundSubscriptions({
  secret,
  apply = false,
  fetchImpl = fetch,
}) {
  if (!secret) {
    throw new Error("Stripe credential is not configured");
  }
  async function request(path, params) {
    const response = await fetchImpl(`https://api.stripe.com/v1${path}`, {
      body: params?.toString(),
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: params ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(
        `Stripe webhook configuration request failed (${response.status})`
      );
    }
    return await response.json();
  }
  const body = await request("/webhook_endpoints?limit=100");
  if (!Array.isArray(body.data) || body.has_more) {
    throw new Error("Stripe endpoint listing is incomplete");
  }
  const matches = body.data.filter(
    (endpoint) => endpoint.url === endpointUrl && endpoint.status === "enabled"
  );
  if (matches.length === 0) {
    throw new Error(
      "No enabled SoundKit commerce endpoint found; none created"
    );
  }
  const result = [];
  for (const endpoint of matches) {
    if (
      !/^we_[a-z\d_]+$/iu.test(endpoint.id) ||
      !Array.isArray(endpoint.enabled_events)
    ) {
      throw new Error("Invalid SoundKit webhook configuration");
    }
    const missing = endpoint.enabled_events.includes("*")
      ? []
      : refundEvents.filter(
          (event) => !endpoint.enabled_events.includes(event)
        );
    if (missing.length > 0 && apply) {
      const params = new URLSearchParams();
      for (const event of new Set([...endpoint.enabled_events, ...missing])) {
        params.append("enabled_events[]", event);
      }
      const updated = await request(
        `/webhook_endpoints/${endpoint.id}`,
        params
      );
      if (
        updated.id !== endpoint.id ||
        updated.url !== endpointUrl ||
        !Array.isArray(updated.enabled_events) ||
        ![...endpoint.enabled_events, ...refundEvents].every((event) =>
          updated.enabled_events.includes(event)
        )
      ) {
        throw new Error("Stripe webhook subscription verification failed");
      }
    }
    result.push({
      connect: Boolean(endpoint.connect),
      livemode: endpoint.livemode === true,
      missing,
      updated: apply && missing.length > 0,
    });
  }
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await syncRefundSubscriptions({
      apply: process.env.APPLY_REFUND_EVENTS === "true",
      secret: process.env.STRIPE_SECRET_KEY,
    });
    console.info(JSON.stringify(result));
  } catch {
    console.error(
      "Stripe refund-event configuration failed; no signing secrets or payment operations were changed."
    );
    process.exitCode = 1;
  }
}
