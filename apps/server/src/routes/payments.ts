import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  battles,
  carts,
  cartItems,
  listeningParties,
  liveExperiences,
  orderItems,
  orders,
  sellerAccounts,
} from "@soundkit/db/schema/app";
import { platformFees, tips, transactions } from "@soundkit/db/schema/payments";
import { and, eq, or } from "drizzle-orm";
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
import { refreshSellerAccount } from "@/lib/seller";
import {
  createDestinationCheckout,
  createEmbeddedTipCheckout,
  retrieveCheckoutSession,
} from "@/lib/stripe";
import { buildTipAllocations } from "@/lib/tips";
import type { AppEnv } from "@/lib/types";
import { logError } from "@/middleware/structured-logging";

interface TipEvent {
  kind: "battle" | "party" | "stream";
  recipientUserIds: string[];
}

const resolveTipEvent = async ({
    db,
    eventId,
  }: {
    db: ReturnType<typeof createDb>;
    eventId: string;
  }): Promise<TipEvent | null> => {
    const [experience] = await db
      .select({
        battleId: liveExperiences.battleId,
        createdByUserId: liveExperiences.createdByUserId,
        kind: liveExperiences.kind,
        status: liveExperiences.status,
        visibility: liveExperiences.visibility,
      })
      .from(liveExperiences)
      .where(
        or(
          eq(liveExperiences.id, eventId),
          eq(liveExperiences.streamInputId, eventId)
        )
      )
      .limit(1);

    if (
      experience &&
      experience.status === "live" &&
      experience.visibility === "public"
    ) {
      if (experience.kind !== "battle") {
        return {
          kind: experience.kind,
          recipientUserIds: [experience.createdByUserId],
        };
      }

      if (experience.battleId) {
        const [battle] = await db
          .select({
            challengerArtistUserId: battles.challengerArtistUserId,
            opponentArtistUserId: battles.opponentArtistUserId,
            status: battles.status,
            visibility: battles.visibility,
          })
          .from(battles)
          .where(eq(battles.id, experience.battleId))
          .limit(1);

        if (battle?.status === "live" && battle.visibility === "public") {
          return {
            kind: "battle",
            recipientUserIds: [
              battle.challengerArtistUserId,
              battle.opponentArtistUserId,
            ].filter((userId): userId is string => Boolean(userId)),
          };
        }
      }
    }

    const [party] = await db
      .select({
        hostUserId: listeningParties.hostUserId,
        status: listeningParties.status,
        visibility: liveExperiences.visibility,
      })
      .from(listeningParties)
      .innerJoin(
        liveExperiences,
        eq(liveExperiences.id, listeningParties.liveRoomId)
      )
      .where(eq(listeningParties.id, eventId))
      .limit(1);

    if (party?.status === "live" && party.visibility === "public") {
      return { kind: "party", recipientUserIds: [party.hostUserId] };
    }

    const [battle] = await db
      .select({
        challengerArtistUserId: battles.challengerArtistUserId,
        opponentArtistUserId: battles.opponentArtistUserId,
        status: battles.status,
        visibility: battles.visibility,
      })
      .from(battles)
      .where(or(eq(battles.id, eventId), eq(battles.externalBattleId, eventId)))
      .limit(1);

    if (battle?.status !== "live" || battle.visibility !== "public") {
      return null;
    }

    return {
      kind: "battle",
      recipientUserIds: [
        battle.challengerArtistUserId,
        battle.opponentArtistUserId,
      ].filter((userId): userId is string => Boolean(userId)),
    };
  },
  app = new OpenAPIHono<AppEnv>(),
  checkoutResponseSchema = z.object({
    checkoutUrl: z.string().url().nullable(),
    clientSecret: z.string().nullable(),
    setupRequired: z.boolean(),
    transactionId: z.string().nullable(),
  }),
  checkoutBodySchema = z.object({
    // Stable per checkout intent; retries with the same key return the same
    // order and Stripe session instead of creating duplicates.
    cancelUrl: z.url(),
    idempotencyKey: z.uuid().optional(),
    successUrl: z.url(),
  }),
  tipBodySchema = checkoutBodySchema.extend({
    amountCents: z.number().int().min(100).max(100_000),
    artistUserId: z.string().optional(),
    liveExperienceId: z.string().optional(),
    liveKind: z.enum(["battle", "party", "stream"]).optional(),
    message: z.string().max(500).optional(),
    recipientUserIds: z.string().array().min(1).max(2).optional(),
  }),
  getEnabledSeller = async (userId: string) => {
    await refreshSellerAccount({ organizationId: null, userId });
    const db = createDb(),
      [seller] = await db
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
        {
          checkoutUrl: null,
          clientSecret: null,
          setupRequired: true,
          transactionId: null,
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      [cart] = await db
        .select()
        .from(carts)
        .where(eq(carts.userId, user.id))
        .limit(1),
      items = cart
        ? await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id))
        : [];

    if (items.length === 0) {
      return c.json({ message: "Cart is empty." }, HttpStatusCodes.BAD_REQUEST);
    }

    const body = c.req.valid("json"),
      // A retried checkout with the same key resolves to the original order
      // instead of creating duplicates.
      existingOrder = body.idempotencyKey
        ? (
            await db
              .select({
                id: orders.id,
                status: orders.status,
                transactionId: orders.transactionId,
              })
              .from(orders)
              .where(eq(orders.idempotencyKey, body.idempotencyKey))
              .limit(1)
          )[0]
        : undefined;

    if (existingOrder) {
      const [existingTransaction] = existingOrder.transactionId
        ? await db
            .select({
              id: transactions.id,
              stripeCheckoutSessionId: transactions.stripeCheckoutSessionId,
            })
            .from(transactions)
            .where(eq(transactions.id, existingOrder.transactionId))
            .limit(1)
        : [];

      // Re-resolve the live session URL; expired sessions return null and
      // the buyer starts a fresh checkout intent with a new key.
      let checkoutUrl: null | string = null;
      if (
        existingTransaction?.stripeCheckoutSessionId &&
        existingOrder.status === "checkout_pending"
      ) {
        checkoutUrl =
          (
            await retrieveCheckoutSession(
              existingTransaction.stripeCheckoutSessionId
            )
          )?.url ?? null;
      }

      return c.json(
        {
          checkoutUrl,
          clientSecret: null,
          setupRequired: false,
          transactionId: existingTransaction?.id ?? null,
        },
        HttpStatusCodes.OK
      );
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
      ),
      platformFeeCents = calculateFeeCents({
        amountCents,
        basisPoints: PRODUCT_PLATFORM_FEE_BPS,
      }),
      transactionId = crypto.randomUUID(),
      orderId = crypto.randomUUID();

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
      idempotencyKey: body.idempotencyKey ?? null,
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

    const checkout = await createDestinationCheckout({
      applicationFeeCents: platformFeeCents,
      cancelUrl: body.cancelUrl,
      customerEmail: user.email,
      destinationAccountId: seller.stripeAccountId,
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
        clientSecret: null,
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
      [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
        z.object({ message: z.string() }),
        "Tip checkout provider unavailable"
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
        {
          checkoutUrl: null,
          clientSecret: null,
          setupRequired: true,
          transactionId: null,
        },
        HttpStatusCodes.OK
      );
    }

    const body = c.req.valid("json"),
      recipientUserIds =
        body.recipientUserIds ?? (body.artistUserId ? [body.artistUserId] : []),
      hasDuplicateRecipients =
        new Set(recipientUserIds).size !== recipientUserIds.length;

    if (recipientUserIds.length === 0 || hasDuplicateRecipients) {
      return c.json(
        { message: "Choose at least one unique tip recipient." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const db = createDb(),
      [existingTip] = body.idempotencyKey
        ? await db
            .select({
              id: transactions.id,
              stripeCheckoutSessionId: transactions.stripeCheckoutSessionId,
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.buyerUserId, user.id),
                eq(transactions.idempotencyKey, body.idempotencyKey),
                eq(transactions.transactionType, "tip")
              )
            )
            .limit(1)
        : [];

    if (existingTip) {
      const existingCheckout = existingTip.stripeCheckoutSessionId
        ? await retrieveCheckoutSession(existingTip.stripeCheckoutSessionId)
        : null;
      return c.json(
        {
          checkoutUrl: null,
          clientSecret: existingCheckout?.client_secret ?? null,
          setupRequired: !existingCheckout?.client_secret,
          transactionId: existingTip.id,
        },
        HttpStatusCodes.OK
      );
    }

    const tipEvent = body.liveExperienceId
      ? await resolveTipEvent({ db, eventId: body.liveExperienceId })
      : null;

    if (body.liveExperienceId || body.liveKind) {
      if (!tipEvent || !body.liveKind || tipEvent.kind !== body.liveKind) {
        return c.json(
          { message: "Tips are only available for public live events." },
          HttpStatusCodes.BAD_REQUEST
        );
      }

      const validRecipientIds = new Set(tipEvent.recipientUserIds);
      if (tipEvent.kind !== "battle" && recipientUserIds.length !== 1) {
        return c.json(
          { message: "This live event has one tip recipient." },
          HttpStatusCodes.BAD_REQUEST
        );
      }
      if (recipientUserIds.some((id) => !validRecipientIds.has(id))) {
        return c.json(
          { message: "The selected tip recipient is not in this live event." },
          HttpStatusCodes.BAD_REQUEST
        );
      }
    } else if (recipientUserIds.length !== 1) {
      return c.json(
        { message: "A live event is required for multiple recipients." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const sellers = await Promise.all(
        recipientUserIds.map((userId) => getEnabledSeller(userId))
      ),
      hasUnavailableSeller = sellers.some((seller) => !seller);

    if (hasUnavailableSeller) {
      return c.json(
        { message: "The artist is not ready to receive tips." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const platformFeeCents = calculateFeeCents({
        amountCents: body.amountCents,
        basisPoints: TIP_PLATFORM_FEE_BPS,
      }),
      transactionId = crypto.randomUUID(),
      allocations = buildTipAllocations({
        amountCents: body.amountCents,
        artistAmountCents: body.amountCents - platformFeeCents,
        recipientUserIds,
      }),
      isSplitTip = allocations.length > 1,
      metadata = {
        tipDelivery: isSplitTip ? "transfers" : "destination",
        transactionId,
        transactionType: "tip",
        ...(body.liveExperienceId
          ? { liveExperienceId: body.liveExperienceId }
          : {}),
      };

    await db.transaction(async (tx) => {
      await tx.insert(transactions).values({
        amountCents: body.amountCents,
        artistAmountCents: body.amountCents - platformFeeCents,
        buyerUserId: user.id,
        id: transactionId,
        idempotencyKey: body.idempotencyKey ?? null,
        metadata,
        platformFeeCents,
        sellerUserId: isSplitTip ? null : (recipientUserIds[0] ?? null),
        transactionType: "tip",
      });
      await tx.insert(platformFees).values({
        amountCents: platformFeeCents,
        basisPoints: TIP_PLATFORM_FEE_BPS,
        id: crypto.randomUUID(),
        transactionId,
      });
      await tx.insert(tips).values(
        allocations.map((allocation) => ({
          amountCents: allocation.amountCents,
          artistAmountCents: allocation.artistAmountCents,
          artistUserId: allocation.artistUserId,
          fanUserId: user.id,
          id: crypto.randomUUID(),
          message: body.message,
          transactionId,
        }))
      );
    });

    let checkout: Awaited<ReturnType<typeof createEmbeddedTipCheckout>>;
    try {
      checkout = await createEmbeddedTipCheckout({
        applicationFeeCents: isSplitTip ? undefined : platformFeeCents,
        cancelUrl: body.cancelUrl,
        customerEmail: user.email,
        destinationAccountId: isSplitTip
          ? undefined
          : sellers[0]?.stripeAccountId,
        lineItems: [
          {
            currency: "USD",
            name: isSplitTip ? "Battle tip" : "Artist tip",
            priceCents: body.amountCents,
            quantity: 1,
          },
        ],
        metadata,
        returnUrl: body.successUrl,
      });
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        operation: "create_tip_checkout",
        requestId: c.get("requestId"),
      });
      await db
        .update(transactions)
        .set({ status: "failed" })
        .where(eq(transactions.id, transactionId));
      return c.json(
        { message: "Tip checkout is temporarily unavailable." },
        HttpStatusCodes.BAD_GATEWAY
      );
    }

    if (checkout) {
      await db
        .update(transactions)
        .set({ stripeCheckoutSessionId: checkout.id })
        .where(eq(transactions.id, transactionId));
    }

    return c.json(
      {
        checkoutUrl: null,
        clientSecret: checkout?.client_secret ?? null,
        setupRequired: !checkout?.client_secret,
        transactionId,
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
