import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb } from "@soundkit/db";
import {
  cartItems,
  carts,
  projects,
  trackLicenseOptions,
  tracks,
} from "@soundkit/db/schema/app";
import { and, eq, isNull } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import {
  addCartItemBodySchema,
  cartSchema,
  claimCartBodySchema,
  messageResponseSchema,
  updateCartItemBodySchema,
} from "@/lib/schemas";
import type { AppEnv, AuthenticatedUser } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

type CartResponse = z.infer<typeof cartSchema>;
type CartItemResponse = CartResponse["items"][number];
interface CartMutationResult {
  error: string | null;
}

const centsFromPrice = (price: string | null, priceCents: number | null) => {
    if (typeof priceCents === "number") {
      return priceCents;
    }

    if (!price) {
      return null;
    }

    return Math.round(Number(price) * 100);
  },
  toCartResponse = async (user: AuthenticatedUser): Promise<CartResponse> => {
    const db = createDb(),
      [cart] = await db.select().from(carts).where(eq(carts.userId, user.id));

    if (!cart) {
      return {
        currency: "USD",
        id: null,
        itemCount: 0,
        items: [],
        subtotalCents: 0,
        totalCents: 0,
      };
    }

    const rows = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, cart.id)),
      items: CartItemResponse[] = [];

    for (const row of rows) {
      let licenseName: string | null = null;

      if (row.licenseOptionId) {
        const [license] = await db
          .select({ name: trackLicenseOptions.name })
          .from(trackLicenseOptions)
          .where(eq(trackLicenseOptions.id, row.licenseOptionId));
        licenseName = license?.name ?? null;
      }

      const productId = row.trackId ?? row.projectId ?? row.id,
        productType: "track" | "project" =
          row.productType === "project" ? "project" : "track",
        purchaseMode: "digital_download" | "license" = row.licenseOptionId
          ? "license"
          : "digital_download";

      items.push({
        artistName: null,
        coverArtUrl: null,
        currency: row.currency,
        id: row.id,
        licenseName,
        licenseOptionId: row.licenseOptionId,
        priceCents: row.priceCentsSnapshot,
        productId,
        productType,
        projectId: row.projectId,
        purchaseMode,
        quantity: row.quantity,
        title: row.titleSnapshot,
        trackId: row.trackId,
      });
    }

    const subtotalCents = items.reduce(
        (sum, item) => sum + item.priceCents * item.quantity,
        0
      ),
      itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      currency: "USD",
      id: cart.id,
      itemCount,
      items,
      subtotalCents,
      totalCents: subtotalCents,
    };
  },
  getOrCreateCart = async (user: AuthenticatedUser) => {
    const db = createDb(),
      [existingCart] = await db
        .select()
        .from(carts)
        .where(eq(carts.userId, user.id));

    if (existingCart) {
      return existingCart;
    }

    const [createdCart] = await db
      .insert(carts)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
      })
      .returning();

    if (!createdCart) {
      throw new Error("Unable to create cart.");
    }

    return createdCart;
  },
  addItemToCart = async ({
    body,
    user,
  }: {
    body: z.infer<typeof addCartItemBodySchema>;
    user: AuthenticatedUser;
  }): Promise<CartMutationResult> => {
    const db = createDb(),
      cart = await getOrCreateCart(user),
      quantity = body.quantity ?? 1;

    if (body.productType === "track") {
      if (!body.trackId) {
        return { error: "Track cart items require a trackId." };
      }

      const [track] = await db
        .select()
        .from(tracks)
        .where(eq(tracks.id, body.trackId));

      if (!track) {
        return { error: "Track was not found." };
      }

      let priceCents = centsFromPrice(track.price, track.priceCents),
        titleSnapshot = track.title;

      if (body.licenseOptionId) {
        const [license] = await db
          .select()
          .from(trackLicenseOptions)
          .where(
            and(
              eq(trackLicenseOptions.id, body.licenseOptionId),
              eq(trackLicenseOptions.trackId, body.trackId)
            )
          );

        if (!license) {
          return { error: "License option was not found for this track." };
        }

        ({ priceCents } = license);
        titleSnapshot = `${track.title} - ${license.name}`;
      }

      if (typeof priceCents !== "number") {
        return { error: "This track is not priced for cart purchase." };
      }

      const [existingItem] = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, cart.id),
            eq(cartItems.productType, "track"),
            eq(cartItems.trackId, body.trackId),
            body.licenseOptionId
              ? eq(cartItems.licenseOptionId, body.licenseOptionId)
              : isNull(cartItems.licenseOptionId)
          )
        );

      if (existingItem) {
        await db
          .update(cartItems)
          .set({ quantity: existingItem.quantity + quantity })
          .where(eq(cartItems.id, existingItem.id));
        return { error: null };
      }

      await db.insert(cartItems).values({
        cartId: cart.id,
        currency: track.currency,
        id: crypto.randomUUID(),
        licenseOptionId: body.licenseOptionId,
        priceCentsSnapshot: priceCents,
        productType: "track",
        quantity,
        sellerUserId: track.ownerUserId,
        titleSnapshot,
        trackId: track.id,
      });

      return { error: null };
    }

    if (!body.projectId) {
      return { error: "Project cart items require a projectId." };
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, body.projectId));

    if (!project) {
      return { error: "Project was not found." };
    }

    if (typeof project.priceCents !== "number") {
      return { error: "This project is not priced for cart purchase." };
    }

    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productType, "project"),
          eq(cartItems.projectId, body.projectId)
        )
      );

    if (existingItem) {
      await db
        .update(cartItems)
        .set({ quantity: existingItem.quantity + quantity })
        .where(eq(cartItems.id, existingItem.id));
      return { error: null };
    }

    await db.insert(cartItems).values({
      cartId: cart.id,
      currency: project.currency,
      id: crypto.randomUUID(),
      priceCentsSnapshot: project.priceCents,
      productType: "project",
      projectId: project.id,
      quantity,
      sellerUserId: project.ownerUserId,
      titleSnapshot: project.title,
    });

    return { error: null };
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(cartSchema, "Current cart"),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Cart"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    return c.json(await toCartResponse(user), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/items",
    request: {
      body: jsonContentRequired(addCartItemBodySchema, "Cart item payload"),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(cartSchema, "Updated cart"),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid cart item"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Cart"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const result = await addItemToCart({
      body: c.req.valid("json"),
      user,
    });

    if (result.error) {
      return c.json({ message: result.error }, HttpStatusCodes.BAD_REQUEST);
    }

    return c.json(await toCartResponse(user), HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/items/{cartItemId}",
    request: {
      body: jsonContentRequired(
        updateCartItemBodySchema,
        "Cart item update payload"
      ),
      params: z.object({
        cartItemId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(cartSchema, "Updated cart"),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Cart"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const body = c.req.valid("json"),
      { cartItemId } = c.req.valid("param"),
      db = createDb(),
      cart = await getOrCreateCart(user);

    await db
      .update(cartItems)
      .set({ quantity: body.quantity })
      .where(and(eq(cartItems.id, cartItemId), eq(cartItems.cartId, cart.id)));

    return c.json(await toCartResponse(user), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/items/{cartItemId}",
    request: {
      params: z.object({
        cartItemId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(cartSchema, "Updated cart"),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Cart"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { cartItemId } = c.req.valid("param"),
      db = createDb(),
      cart = await getOrCreateCart(user);

    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, cartItemId), eq(cartItems.cartId, cart.id)));

    return c.json(await toCartResponse(user), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(cartSchema, "Cleared cart"),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Cart"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const db = createDb(),
      cart = await getOrCreateCart(user);

    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));

    return c.json(await toCartResponse(user), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/claim",
    request: {
      body: jsonContentRequired(
        claimCartBodySchema,
        "Guest cart claim payload"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(cartSchema, "Claimed cart"),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid cart item"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Cart"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    for (const item of c.req.valid("json").items) {
      const result = await addItemToCart({ body: item, user });

      if (result.error) {
        return c.json({ message: result.error }, HttpStatusCodes.BAD_REQUEST);
      }
    }

    return c.json(await toCartResponse(user), HttpStatusCodes.OK);
  }
);

export default app;
