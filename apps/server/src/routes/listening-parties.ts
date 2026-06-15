import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { listeningParties, projects } from "@soundkit/db/schema/app";
import { and, desc, eq, gte } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  unauthorizedMessage,
} from "@/lib/entitlements";
import {
  createListeningPartyBodySchema,
  listeningPartySummarySchema,
  messageResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();

const mapParty = (party: typeof listeningParties.$inferSelect) => ({
  description: party.description,
  endedAt: party.endedAt?.toISOString() ?? null,
  hostUserId: party.hostUserId,
  id: party.id,
  liveRoomId: party.liveRoomId,
  organizationId: party.organizationId,
  playbackMode: party.playbackMode,
  projectId: party.projectId,
  scheduledStartAt: party.scheduledStartAt.toISOString(),
  startedAt: party.startedAt?.toISOString() ?? null,
  status: party.status,
  title: party.title,
});

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        listeningPartySummarySchema.array(),
        "Listening parties"
      ),
    },
    tags: ["Listening Parties"],
  }),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const rows = await createDb()
      .select()
      .from(listeningParties)
      .where(gte(listeningParties.scheduledStartAt, new Date()))
      .orderBy(desc(listeningParties.scheduledStartAt))
      .limit(50);

    return c.json(rows.map(mapParty), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(
        createListeningPartyBodySchema,
        "Listening party payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        listeningPartySummarySchema,
        "Listening party"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Project not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Listening Parties"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const body = c.req.valid("json");
    const db = createDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(
        and(eq(projects.id, body.projectId), eq(projects.ownerUserId, user.id))
      )
      .limit(1);

    if (!project || project.projectType === "single") {
      return c.json(
        { message: "Album or EP project not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const [party] = await db
      .insert(listeningParties)
      .values({
        description: body.description ?? null,
        hostUserId: user.id,
        id: crypto.randomUUID(),
        liveRoomId: crypto.randomUUID(),
        organizationId,
        playbackMode: body.playbackMode,
        projectId: body.projectId,
        scheduledStartAt: new Date(body.scheduledStartAt),
        title: body.title,
      })
      .returning();

    if (!party) {
      throw new Error("Failed to create listening party.");
    }

    return c.json(mapParty(party), HttpStatusCodes.CREATED);
  }
);

export default app;
