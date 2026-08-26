/* eslint-disable one-var, sort-vars, unicorn/max-nested-calls */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { sellerAccounts } from "@soundkit/db/schema/app";
import {
  communities,
  communityBans,
  communitySubscriptions,
} from "@soundkit/db/schema/communities";
import { platformFees, transactions } from "@soundkit/db/schema/payments";
import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { loadCommunitySchemaCapabilities } from "@/lib/community-schema-capabilities";
import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import { calculateFeeCents, COMMUNITY_PLATFORM_FEE_BPS } from "@/lib/fees";
import { createConnectedSubscriptionCheckout } from "@/lib/stripe";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  checkoutBodySchema = z.object({
    cancelUrl: z.url(),
    communityId: z.string(),
    successUrl: z.url(),
  }),
  responseSchema = z.object({
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
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Community access prohibited"
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

    const body = c.req.valid("json"),
      db = createDb(),
      capabilities = await loadCommunitySchemaCapabilities(),
      [community] = await db
        .select({
          artistUserId: communities.artistUserId,
          currency: communities.currency,
          id: communities.id,
          isActive: communities.isActive,
          monthlyPriceCents: communities.monthlyPriceCents,
          name: communities.name,
        })
        .from(communities)
        .where(eq(communities.id, body.communityId))
        .limit(1);

    if (
      !community?.isActive ||
      community.monthlyPriceCents === 0 ||
      community.artistUserId === user.id
    ) {
      return c.json(
        { message: "Community is not available for subscription." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const [ban] = capabilities.bans
      ? await db
          .select({ userId: communityBans.userId })
          .from(communityBans)
          .where(
            and(
              eq(communityBans.communityId, community.id),
              eq(communityBans.userId, user.id)
            )
          )
          .limit(1)
      : [];

    if (ban) {
      return c.json(
        { message: "You cannot subscribe to this community." },
        HttpStatusCodes.FORBIDDEN
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

    const subscriptionId = crypto.randomUUID(),
      transactionId = crypto.randomUUID(),
      feeCents = calculateFeeCents({
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
