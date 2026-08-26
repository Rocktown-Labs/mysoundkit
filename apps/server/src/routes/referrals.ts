import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { platformInvites } from "@soundkit/db/schema/referrals";
import { and, count, eq, gte } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { getPublicSiteUrl, sendTransactionalEmail } from "@/lib/email";
import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import {
  messageResponseSchema,
  platformInviteBodySchema,
  platformInviteResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  MAX_DAILY_INVITES = 10,
  normalizeEmail = (email: string) => email.trim().toLowerCase();

app.openapi(
  createRoute({
    method: "post",
    path: "/invite",
    request: {
      body: jsonContentRequired(
        platformInviteBodySchema,
        "Platform invitation"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        platformInviteResponseSchema,
        "Platform invitation sent"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Invitation email unavailable"
      ),
      [HttpStatusCodes.TOO_MANY_REQUESTS]: jsonContent(
        messageResponseSchema,
        "Invitation rate limit reached"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Referrals"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Invitations require a configured database." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const email = normalizeEmail(c.req.valid("json").email),
      db = createDb(),
      today = new Date(Date.now() - 86_400_000),
      [dailyCount, existing] = await Promise.all([
        db
          .select({ value: count() })
          .from(platformInvites)
          .where(
            and(
              eq(platformInvites.inviterUserId, user.id),
              gte(platformInvites.createdAt, today)
            )
          ),
        db
          .select()
          .from(platformInvites)
          .where(
            and(
              eq(platformInvites.email, email),
              eq(platformInvites.inviterUserId, user.id)
            )
          )
          .limit(1),
      ]),
      previousInvite = existing[0];

    if (previousInvite?.status === "sent") {
      return c.json(
        {
          alreadyInvited: true,
          message: "That friend has already been invited.",
          sent: true,
        },
        HttpStatusCodes.OK
      );
    }

    if (Number(dailyCount[0]?.value ?? 0) >= MAX_DAILY_INVITES) {
      return c.json(
        { message: "You have reached today’s invitation limit." },
        HttpStatusCodes.TOO_MANY_REQUESTS
      );
    }

    const invite =
      previousInvite ??
      (
        await db
          .insert(platformInvites)
          .values({
            email,
            id: crypto.randomUUID(),
            inviterUserId: user.id,
            lastAttemptAt: new Date(),
            status: "pending",
          })
          .returning()
      )[0];

    if (!invite) {
      return c.json(
        { message: "Unable to create invitation." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    await db
      .update(platformInvites)
      .set({ lastAttemptAt: new Date(), status: "pending" })
      .where(eq(platformInvites.id, invite.id));

    const result = await sendTransactionalEmail({
      idempotencyKey: `platform-invite/${invite.id}`,
      payload: {
        actionUrl: `${getPublicSiteUrl().replace(/\/$/u, "")}/signup`,
        body: `${user.name ?? "A SoundKit member"} invited you to join SoundKit. Create your account to discover music, connect with artists, and join the community.`,
        ctaLabel: "Join SoundKit",
        eyebrow: "You’re invited",
        footerNote:
          "You are receiving this because a SoundKit member entered your email address to invite you to the platform.",
        heading: `${user.name ?? "A SoundKit member"} invited you to SoundKit`,
        previewText: `${user.name ?? "A SoundKit member"} invited you to join SoundKit.`,
        recipientName: email.split("@")[0] ?? "there",
        subject: `${user.name ?? "A SoundKit member"} invited you to SoundKit`,
      },
      recipientEmail: email,
      template: "platform_invite",
    });

    if (!result.sent) {
      await db
        .update(platformInvites)
        .set({ lastAttemptAt: new Date(), status: "failed" })
        .where(eq(platformInvites.id, invite.id));
      return c.json(
        {
          message: "The invitation email could not be sent. Try again shortly.",
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    await db
      .update(platformInvites)
      .set({ lastAttemptAt: new Date(), sentAt: new Date(), status: "sent" })
      .where(eq(platformInvites.id, invite.id));

    return c.json(
      {
        alreadyInvited: Boolean(previousInvite),
        message: `Invitation sent to ${email}.`,
        sent: true,
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
