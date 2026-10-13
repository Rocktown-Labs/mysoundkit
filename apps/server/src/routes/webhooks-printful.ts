/* eslint-disable unicorn/max-nested-calls, sort-vars, one-var, complexity, no-nested-ternary */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { orders, webhookEvents } from "@soundkit/db/schema/app";
import {
  merchFulfillments,
  merchShipments,
} from "@soundkit/db/schema/fulfillment";
import { env } from "@soundkit/env/server";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import type { AppEnv } from "@/lib/types";
import { logWarn } from "@/middleware/structured-logging";

const app = new OpenAPIHono<AppEnv>(),
  getEnvValue = (key: string) =>
    (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "",
  hexToBytes = (value: string) => {
    if (!/^[\da-f]+$/iu.test(value) || value.length % 2 !== 0) {
      return null;
    }

    return new Uint8Array(
      value.match(/.{2}/gu)?.map((byte) => Number.parseInt(byte, 16)) ?? []
    );
  };

/**
 * Printful v2 signs webhooks with HMAC-SHA256 keyed by the configuration's
 * secret key (hex-encoded, decode before use). The signature is in the
 * `x-pf-webhook-signature` header (hex representation of the HMAC).
 */
export const verifyPrintfulWebhookSignature = async ({
    payload,
    signature,
    secretKey,
  }: {
    payload: string;
    secretKey: string;
    signature: string | null;
  }) => {
    if (!signature) {
      return false;
    }

    // Decode the hex-encoded secret key to raw bytes.
    const keyBytes = hexToBytes(secretKey);

    if (!keyBytes) {
      logWarn({
        event: "printful_webhook_secret_invalid_hex",
      });
      return false;
    }

    const key = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { hash: "SHA-256", name: "HMAC" },
        false,
        ["verify"]
      ),
      signatureBytes = hexToBytes(signature);

    if (!signatureBytes) {
      return false;
    }

    return crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(payload)
    );
  },
  webhookEventSchema = z.object({
    data: z.record(z.string(), z.unknown()),
    occurred_at: z.string().optional(),
    retries: z.number().optional(),
    store_id: z.number().optional(),
    type: z.string(),
  });

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ message: z.string() }),
        "Printful webhook accepted"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid or missing signature"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        z.object({ message: z.string() }),
        "Printful webhook secret not configured"
      ),
    },
    tags: ["Webhooks"],
  }),
  async (c) => {
    const secretKey = getEnvValue("PRINTFUL_WEBHOOK_SECRET");

    if (!secretKey) {
      return c.json(
        {
          message:
            "Printful webhook verification is not configured. Set PRINTFUL_WEBHOOK_SECRET.",
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const payload = await c.req.raw.text(),
      signature = c.req.raw.headers.get("x-pf-webhook-signature");

    if (
      !(await verifyPrintfulWebhookSignature({
        payload,
        secretKey,
        signature,
      }))
    ) {
      logWarn({
        event: "printful_webhook_signature_invalid",
      });
      return c.json(
        { message: "Invalid or missing Printful webhook signature." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const event = JSON.parse(payload) as z.infer<typeof webhookEventSchema>;

    if (!event.type) {
      return c.json(
        { message: "Printful webhook accepted." },
        HttpStatusCodes.OK
      );
    }

    // Dedupe via the shared webhookEvents table; construct a stable synthetic
    // event id since Printful v2 events carry no UUID.
    const data = event.data as Record<string, unknown>,
      orderData = (data.order ?? {}) as Record<string, unknown>,
      shipmentData = (data.shipment ?? {}) as Record<string, unknown>,
      externalEventId = `${event.type}:${String(orderData.external_id ?? shipmentData.id ?? "unknown")}:${event.occurred_at ?? "unknown"}`;

    if (!(isDatabaseConfigured() && externalEventId)) {
      return c.json(
        { message: "Printful webhook accepted." },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      [existingEvent] = await db
        .select({ id: webhookEvents.id })
        .from(webhookEvents)
        .where(eq(webhookEvents.externalEventId, externalEventId))
        .limit(1);

    if (existingEvent) {
      return c.json(
        { message: "Printful webhook already processed." },
        HttpStatusCodes.OK
      );
    }

    await db.insert(webhookEvents).values({
      eventType: event.type,
      externalEventId,
      id: crypto.randomUUID(),
      payload: event as unknown as Record<string, unknown>,
      provider: "printful",
      status: "received",
    });

    try {
      await processPrintfulEvent({ db, event });
      await db
        .update(webhookEvents)
        .set({ processedAt: new Date(), status: "processed" })
        .where(eq(webhookEvents.externalEventId, externalEventId));
    } catch (error) {
      logWarn({
        error: error instanceof Error ? error.message : String(error),
        event: "printful_webhook_processing_failed",
        eventType: event.type,
      });
      await db
        .update(webhookEvents)
        .set({ status: "failed" })
        .where(eq(webhookEvents.externalEventId, externalEventId));
    }

    return c.json(
      { message: "Printful webhook accepted." },
      HttpStatusCodes.OK
    );
  }
);

const processPrintfulEvent = async ({
  db,
  event,
}: {
  db: ReturnType<typeof createDb>;
  event: z.infer<typeof webhookEventSchema>;
}) => {
  const data = event.data as Record<string, unknown>,
    orderData = (data.order ?? {}) as Record<string, unknown>,
    shipmentData = (data.shipment ?? {}) as Record<string, unknown>,
    externalId =
      typeof orderData.external_id === "string" ? orderData.external_id : null;

  if (!externalId) {
    return;
  }

  const [fulfillment] = await db
    .select()
    .from(merchFulfillments)
    .where(eq(merchFulfillments.externalId, externalId))
    .limit(1);

  if (!fulfillment) {
    logWarn({
      event: "printful_webhook_orphan_order",
      externalId,
    });
    return;
  }

  switch (event.type) {
    case "order_failed":
    case "order_canceled": {
      await db
        .update(merchFulfillments)
        .set({
          lastError: typeof data.reason === "string" ? data.reason : event.type,
          status: "failed",
        })
        .where(eq(merchFulfillments.id, fulfillment.id));
      break;
    }

    case "order_updated": {
      const status =
        typeof orderData.status === "string"
          ? orderData.status
          : fulfillment.status;

      await db
        .update(merchFulfillments)
        .set({ lastSyncedAt: new Date(), status })
        .where(eq(merchFulfillments.id, fulfillment.id));
      break;
    }

    case "shipment_sent": {
      const trackingNumber =
          typeof shipmentData.tracking_number === "string"
            ? shipmentData.tracking_number
            : null,
        trackingUrl =
          typeof shipmentData.tracking_url === "string"
            ? shipmentData.tracking_url
            : null,
        carrier =
          typeof shipmentData.carrier === "string"
            ? shipmentData.carrier
            : null,
        printfulShipmentId =
          typeof shipmentData.id === "number" ? String(shipmentData.id) : null;

      if (printfulShipmentId) {
        await db
          .insert(merchShipments)
          .values({
            carrier,
            fulfillmentId: fulfillment.id,
            id: crypto.randomUUID(),
            printfulShipmentId,
            shippedAt: new Date(),
            status: "in_transit",
            trackingEvents: [],
            trackingNumber,
            trackingUrl,
          })
          .onConflictDoUpdate({
            set: {
              carrier,
              shippedAt: new Date(),
              status: "in_transit",
              trackingNumber,
              trackingUrl,
            },
            target: merchShipments.printfulShipmentId,
          });
      }

      // Update the denormalized tracking fields on the order.
      await db
        .update(orders)
        .set({
          fulfillmentStatus: "shipped",
          shippedAt: new Date(),
          trackingNumber,
          trackingType: carrier,
        })
        .where(eq(orders.id, fulfillment.orderId));

      await db
        .update(merchFulfillments)
        .set({ lastSyncedAt: new Date(), status: "confirmed" })
        .where(eq(merchFulfillments.id, fulfillment.id));
      break;
    }

    case "shipment_delivered": {
      const printfulShipmentId =
        typeof shipmentData.id === "number" ? String(shipmentData.id) : null;

      if (printfulShipmentId) {
        await db
          .update(merchShipments)
          .set({ deliveredAt: new Date(), status: "delivered" })
          .where(eq(merchShipments.printfulShipmentId, printfulShipmentId));
      }

      await db
        .update(orders)
        .set({ fulfillmentStatus: "delivered" })
        .where(eq(orders.id, fulfillment.orderId));
      break;
    }

    case "shipment_out_of_stock":
    case "shipment_canceled":
    case "shipment_returned": {
      const status =
          event.type === "shipment_canceled"
            ? "canceled"
            : event.type === "shipment_returned"
              ? "returned"
              : "out_of_stock",
        printfulShipmentId =
          typeof shipmentData.id === "number" ? String(shipmentData.id) : null;

      if (printfulShipmentId) {
        await db
          .update(merchShipments)
          .set({ status })
          .where(eq(merchShipments.printfulShipmentId, printfulShipmentId));
      }
      break;
    }

    default: {
      // Unhandled events (catalog_stock_updated, catalog_price_changed,
      // mockup_task_finished, etc.) are logged in webhookEvents but don't
      // need fulfillment record updates.
      break;
    }
  }
};

export default app;
