import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { sellerAccounts } from "@soundkit/db/schema/app";
import {
  communities,
  communitySubscriptions,
} from "@soundkit/db/schema/communities";
import { platformFees, transactions } from "@soundkit/db/schema/payments";
import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import { calculateFeeCents, COMMUNITY_PLATFORM_FEE_BPS } from "@/lib/fees";
import { createConnectedSubscriptionCheckout } from "@/lib/stripe";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();
const checkoutBodySchema = z.object({
  cancelUrl: z.url(),
  communityId: z.string(),
  successUrl: z.url(),
});
const responseSchema = z.object({
  checkoutUrl: z.string().url().nullable(),
  setupRequired: z.boolean(),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/checkout",
    request: {
      body: jsonContentRequired(checkoutBodySchema, "Community checkout"),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(responseSchema, "Community checkout"),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid community"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Community Billing"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { checkoutUrl: null, setupRequired: true },
        HttpStatusCodes.OK
      );
    }

    const body = c.req.valid("json");
    const db = createDb();
    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, body.communityId))
      .limit(1);

    if (!community?.isActive || community.artistUserId === user.id) {
      return c.json(
        { message: "Community is not available for subscription." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const [seller] = await db
      .select()
      .from(sellerAccounts)
      .where(
        and(
          eq(sellerAccounts.userId, community.artistUserId),
          eq(sellerAccounts.onboardingStatus, "enabled")
        )
      )
      .limit(1);

    if (!seller) {
      return c.json(
        { message: "Community billing is not configured." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const subscriptionId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    const feeCents = calculateFeeCents({
      amountCents: community.monthlyPriceCents,
      basisPoints: COMMUNITY_PLATFORM_FEE_BPS,
    });

    await db.insert(communitySubscriptions).values({
      communityId: community.id,
      id: subscriptionId,
      status: "pending",
      userId: user.id,
    });
    await db.insert(transactions).values({
      amountCents: community.monthlyPriceCents,
      artistAmountCents: community.monthlyPriceCents - feeCents,
      buyerUserId: user.id,
      id: transactionId,
      metadata: { communityId: community.id, subscriptionId },
      platformFeeCents: feeCents,
      sellerUserId: community.artistUserId,
      transactionType: "community_subscription",
    });
    await db.insert(platformFees).values({
      amountCents: feeCents,
      basisPoints: COMMUNITY_PLATFORM_FEE_BPS,
      id: crypto.randomUUID(),
      transactionId,
    });

    const checkout = await createConnectedSubscriptionCheckout({
      applicationFeePercent: COMMUNITY_PLATFORM_FEE_BPS / 100,
      cancelUrl: body.cancelUrl,
      connectedAccountId: seller.stripeAccountId,
      currency: community.currency,
      customerEmail: user.email,
      metadata: {
        communityId: community.id,
        communitySubscriptionId: subscriptionId,
        transactionId,
        userId: user.id,
      },
      monthlyPriceCents: community.monthlyPriceCents,
      name: `${community.name} membership`,
      successUrl: body.successUrl,
    });

    return c.json(
      { checkoutUrl: checkout?.url ?? null, setupRequired: !checkout?.url },
      HttpStatusCodes.OK
    );
  }
);

export default app;
