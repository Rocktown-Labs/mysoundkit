import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  orderItems,
  orders,
  cartItems,
  carts,
  sellerAccounts,
} from "@soundkit/db/schema/app";
import { platformFees, tips, transactions } from "@soundkit/db/schema/payments";
import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { getSingleCheckoutSellerId } from "@/lib/checkout-policy";
import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import {
  calculateFeeCents,
  PRODUCT_PLATFORM_FEE_BPS,
  TIP_PLATFORM_FEE_BPS,
} from "@/lib/fees";
import { createDestinationCheckout } from "@/lib/stripe";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();
const checkoutResponseSchema = z.object({
  checkoutUrl: z.string().url().nullable(),
  setupRequired: z.boolean(),
  transactionId: z.string().nullable(),
});
const checkoutBodySchema = z.object({
  cancelUrl: z.url(),
  successUrl: z.url(),
});
const tipBodySchema = checkoutBodySchema.extend({
  amountCents: z.number().int().min(100).max(100_000),
  artistUserId: z.string(),
  message: z.string().max(500).optional(),
});

const getEnabledSeller = async (userId: string) => {
  const db = createDb();
  const [seller] = await db
    .select()
    .from(sellerAccounts)
    .where(
      and(
        eq(sellerAccounts.userId, userId),
        eq(sellerAccounts.onboardingStatus, "enabled"),
        eq(sellerAccounts.chargesEnabled, true)
      )
    )
    .limit(1);

  return seller ?? null;
};

app.openapi(
  createRoute({
    method: "post",
    path: "/checkout",
    request: {
      body: jsonContentRequired(checkoutBodySchema, "Native checkout payload"),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        checkoutResponseSchema,
        "Native checkout"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid checkout"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Payments"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { checkoutUrl: null, setupRequired: true, transactionId: null },
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, user.id))
      .limit(1);
    const items = cart
      ? await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id))
      : [];

    if (items.length === 0) {
      return c.json({ message: "Cart is empty." }, HttpStatusCodes.BAD_REQUEST);
    }

    const sellerId = getSingleCheckoutSellerId(
      items.map((item) => item.sellerUserId)
    );

    if (!sellerId) {
      return c.json(
        { message: "Checkout can contain products from only one artist." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const seller = await getEnabledSeller(sellerId);

    if (!seller) {
      return c.json(
        { message: "The artist is not ready to receive payments." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const amountCents = items.reduce(
      (sum, item) => sum + item.priceCentsSnapshot * item.quantity,
      0
    );
    const platformFeeCents = calculateFeeCents({
      amountCents,
      basisPoints: PRODUCT_PLATFORM_FEE_BPS,
    });
    const transactionId = crypto.randomUUID();
    const orderId = crypto.randomUUID();

    await db.insert(transactions).values({
      amountCents,
      artistAmountCents: amountCents - platformFeeCents,
      buyerUserId: user.id,
      id: transactionId,
      platformFeeCents,
      sellerUserId: sellerId,
      transactionType: "product_purchase",
    });
    await db.insert(platformFees).values({
      amountCents: platformFeeCents,
      basisPoints: PRODUCT_PLATFORM_FEE_BPS,
      id: crypto.randomUUID(),
      transactionId,
    });
    await db.insert(orders).values({
      buyerUserId: user.id,
      id: orderId,
      sellerUserId: sellerId,
      status: "checkout_pending",
      subtotal: (amountCents / 100).toFixed(2),
      total: (amountCents / 100).toFixed(2),
      totalCents: amountCents,
      transactionId,
    });
    await db.insert(orderItems).values(
      items.map((item) => ({
        id: crypto.randomUUID(),
        licenseOptionId: item.licenseOptionId,
        orderId,
        priceSnapshot: (item.priceCentsSnapshot / 100).toFixed(2),
        productType: item.productType,
        projectId: item.projectId,
        quantity: item.quantity,
        titleSnapshot: item.titleSnapshot,
        trackId: item.trackId,
      }))
    );

    const body = c.req.valid("json");
    const checkout = await createDestinationCheckout({
      applicationFeeCents: platformFeeCents,
      cancelUrl: body.cancelUrl,
      connectedAccountId: seller.stripeAccountId,
      customerEmail: user.email,
      lineItems: items.map((item) => ({
        currency: item.currency,
        name: item.titleSnapshot,
        priceCents: item.priceCentsSnapshot,
        quantity: item.quantity,
      })),
      metadata: { transactionId, transactionType: "product_purchase" },
      successUrl: body.successUrl,
    });

    if (checkout) {
      await db
        .update(transactions)
        .set({ stripeCheckoutSessionId: checkout.id })
        .where(eq(transactions.id, transactionId));
      await db
        .update(orders)
        .set({ stripeCheckoutSessionId: checkout.id })
        .where(eq(orders.id, orderId));
    }

    return c.json(
      {
        checkoutUrl: checkout?.url ?? null,
        setupRequired: !checkout?.url,
        transactionId,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/tips",
    request: { body: jsonContentRequired(tipBodySchema, "Artist tip payload") },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(checkoutResponseSchema, "Tip checkout"),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid tip"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Payments"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { checkoutUrl: null, setupRequired: true, transactionId: null },
        HttpStatusCodes.OK
      );
    }

    const body = c.req.valid("json");
    const seller = await getEnabledSeller(body.artistUserId);

    if (!seller) {
      return c.json(
        { message: "The artist is not ready to receive tips." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const db = createDb();
    const platformFeeCents = calculateFeeCents({
      amountCents: body.amountCents,
      basisPoints: TIP_PLATFORM_FEE_BPS,
    });
    const transactionId = crypto.randomUUID();

    await db.insert(transactions).values({
      amountCents: body.amountCents,
      artistAmountCents: body.amountCents - platformFeeCents,
      buyerUserId: user.id,
      id: transactionId,
      platformFeeCents,
      sellerUserId: body.artistUserId,
      transactionType: "tip",
    });
    await db.insert(platformFees).values({
      amountCents: platformFeeCents,
      basisPoints: TIP_PLATFORM_FEE_BPS,
      id: crypto.randomUUID(),
      transactionId,
    });
    await db.insert(tips).values({
      amountCents: body.amountCents,
      artistUserId: body.artistUserId,
      fanUserId: user.id,
      id: crypto.randomUUID(),
      message: body.message,
      transactionId,
    });

    const checkout = await createDestinationCheckout({
      applicationFeeCents: platformFeeCents,
      cancelUrl: body.cancelUrl,
      connectedAccountId: seller.stripeAccountId,
      customerEmail: user.email,
      lineItems: [
        {
          currency: "USD",
          name: "Artist tip",
          priceCents: body.amountCents,
          quantity: 1,
        },
      ],
      metadata: { transactionId, transactionType: "tip" },
      successUrl: body.successUrl,
    });

    if (checkout) {
      await db
        .update(transactions)
        .set({ stripeCheckoutSessionId: checkout.id })
        .where(eq(transactions.id, transactionId));
    }

    return c.json(
      {
        checkoutUrl: checkout?.url ?? null,
        setupRequired: !checkout?.url,
        transactionId,
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
