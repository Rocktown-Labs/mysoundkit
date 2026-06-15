import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { platformFees, transactions } from "@soundkit/db/schema/payments";
import { env } from "@soundkit/env/server";
import { sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { isAuthenticatedUser } from "@/lib/entitlements";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();
const summarySchema = z.object({
  platformFeeCents: z.number().int(),
  successfulTransactionCents: z.number().int(),
  transactionCount: z.number().int(),
});
const getAdminIds = () =>
  ((env as unknown as Record<string, string | undefined>).ADMIN_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

app.openapi(
  createRoute({
    method: "get",
    path: "/summary",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(summarySchema, "Finance summary"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Admin required"
      ),
    },
    tags: ["Admin Finance"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user) || !getAdminIds().includes(user.id)) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          platformFeeCents: 0,
          successfulTransactionCents: 0,
          transactionCount: 0,
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const [transactionSummary] = await db
      .select({
        amountCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(transactions);
    const [feeSummary] = await db
      .select({
        amountCents: sql<number>`coalesce(sum(${platformFees.amountCents}), 0)`,
      })
      .from(platformFees);

    return c.json(
      {
        platformFeeCents: Number(feeSummary?.amountCents ?? 0),
        successfulTransactionCents: Number(
          transactionSummary?.amountCents ?? 0
        ),
        transactionCount: Number(transactionSummary?.count ?? 0),
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
