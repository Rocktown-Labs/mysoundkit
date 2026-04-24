import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfileRoles,
  artistProfiles,
  genres,
  purchases,
  trackAssets,
  trackLicenseOptions,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { sampleCatalogItems, sampleTracks } from "@/lib/sample-data";
import {
  createTrackBodySchema,
  trackCatalogDetailSchema,
  trackSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const formatDuration = (durationMs: number | null) => {
  if (!durationMs) {
    return null;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatPrice = (priceCents: number | null) => {
  if (typeof priceCents !== "number") {
    return "";
  }

  return `$${(priceCents / 100).toFixed(2)}`;
};

const priceCentsFromTrack = ({
  price,
  priceCents,
}: {
  price: string | null;
  priceCents: number | null;
}) => {
  if (typeof priceCents === "number") {
    return priceCents;
  }

  if (!price) {
    return null;
  }

  return Math.round(Number(price) * 100);
};

const assetKindLabels = {
  alternate_mix: "Alternate Mix",
  artwork: "Artwork",
  booklet: "Digital Booklet",
  clean: "Clean Version",
  instrumental: "Instrumental",
  license_pdf: "License Agreement",
  master: "High Quality Master",
  midi: "MIDI Files",
  stems: "Track Stems",
  tagged_mp3: "Tagged MP3",
  untagged_wav: "Untagged WAV",
} as const;

const catalogAssetKinds = new Set(Object.keys(assetKindLabels));

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackSummarySchema.array(),
        "Tracks list"
      ),
    },
    tags: ["Tracks"],
  }),
  (c) => c.json(sampleTracks, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(createTrackBodySchema, "Track create payload"),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        trackSummarySchema,
        "Track created"
      ),
    },
    tags: ["Tracks"],
  }),
  (c) => {
    const body = c.req.valid("json");
    return c.json(
      {
        artistName: "Current Artist",
        catalogItemType: body.catalogItemType,
        duration: "0:00",
        genre: body.genre,
        id: "track_new",
        isForSale: body.isForSale,
        plays: 0,
        price: body.price ?? null,
        priceCents: body.priceCents ?? null,
        purchaseMode: body.purchaseMode,
        releaseAt: body.releaseAt ?? null,
        releaseStrategy: body.releaseStrategy,
        slug: body.title.toLowerCase().replaceAll(" ", "-"),
        title: body.title,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{trackId}",
    request: {
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackCatalogDetailSchema,
        "Track catalog detail"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const { trackId } = c.req.valid("param");
    const [fallbackItem] = sampleCatalogItems;

    if (!fallbackItem) {
      throw new Error("Sample catalog is empty.");
    }

    const sampleItem =
      sampleCatalogItems.find((entry) => entry.id === trackId) ??
      sampleCatalogItems.find((entry) => entry.slug === trackId);

    if (sampleItem || !isDatabaseConfigured()) {
      return c.json(sampleItem ?? fallbackItem, HttpStatusCodes.OK);
    }

    const db = createDb();
    const [row] = await db
      .select({
        artistAvatarUrl: userProfiles.avatarUrl,
        artistBio: userProfiles.bio,
        artistDisplayName: userProfiles.displayName,
        artistName: authUser.name,
        artistUsername: userProfiles.username,
        bpm: tracks.bpm,
        catalogItemType: tracks.catalogItemType,
        currency: tracks.currency,
        description: tracks.description,
        genreName: genres.name,
        id: tracks.id,
        isForSale: tracks.isForSale,
        isVerified: artistProfiles.isVerified,
        musicalKey: tracks.musicalKey,
        ownerUserId: tracks.ownerUserId,
        price: tracks.price,
        priceCents: tracks.priceCents,
        purchaseMode: tracks.purchaseMode,
        slug: tracks.slug,
        title: tracks.title,
      })
      .from(tracks)
      .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
      .leftJoin(artistProfiles, eq(artistProfiles.userId, tracks.ownerUserId))
      .leftJoin(authUser, eq(authUser.id, tracks.ownerUserId))
      .leftJoin(genres, eq(genres.id, tracks.genreId))
      .where(eq(tracks.id, trackId));

    if (!row) {
      return c.json(fallbackItem, HttpStatusCodes.OK);
    }

    const [roleRows, assetRows, licenseRows] = await Promise.all([
      db
        .select({ role: artistProfileRoles.role })
        .from(artistProfileRoles)
        .where(eq(artistProfileRoles.userId, row.ownerUserId)),
      db.select().from(trackAssets).where(eq(trackAssets.trackId, row.id)),
      db
        .select()
        .from(trackLicenseOptions)
        .where(eq(trackLicenseOptions.trackId, row.id)),
    ]);

    const currentUser = c.get("user");
    const purchaseRows = currentUser
      ? await db
          .select({ id: purchases.id })
          .from(purchases)
          .where(
            and(
              eq(purchases.buyerUserId, currentUser.id),
              eq(purchases.trackId, row.id)
            )
          )
      : [];
    const isOwned = purchaseRows.length > 0;

    const roles: ("musician" | "producer")[] =
      roleRows.length > 0
        ? roleRows.map((roleRow) => roleRow.role)
        : ["musician"];
    const coverAsset = assetRows.find(
      (asset) => asset.assetKind === "cover_art"
    );
    const firstAudioAsset = assetRows.find((asset) => asset.durationMs);
    const priceCents = priceCentsFromTrack({
      price: row.price,
      priceCents: row.priceCents,
    });

    const assets = assetRows
      .filter((asset) => catalogAssetKinds.has(asset.assetKind))
      .map((asset) => ({
        duration: formatDuration(asset.durationMs),
        format: asset.mimeType,
        id: asset.id,
        included: asset.status === "ready",
        kind: asset.assetKind as keyof typeof assetKindLabels,
        label:
          assetKindLabels[asset.assetKind as keyof typeof assetKindLabels] ??
          "Track Asset",
        subtitle: asset.mimeType,
      }));

    return c.json(
      {
        artist: {
          avatarUrl: row.artistAvatarUrl,
          followers: null,
          genre: row.genreName,
          handle: row.artistUsername ?? row.ownerUserId,
          id: row.ownerUserId,
          listeners: null,
          location: null,
          name: row.artistDisplayName ?? row.artistName ?? "SoundKit Artist",
          roles,
          verified: row.isVerified ?? false,
        },
        assets,
        bpm: row.bpm,
        catalogItemType: row.catalogItemType,
        coverArtUrl:
          typeof coverAsset?.metadata === "object" &&
          coverAsset.metadata &&
          "url" in coverAsset.metadata
            ? String(coverAsset.metadata.url)
            : "/placeholder.svg",
        currency: row.currency,
        description: row.description,
        duration: formatDuration(firstAudioAsset?.durationMs ?? null),
        genre: row.genreName,
        id: row.id,
        isOwned,
        isPurchasable: row.isForSale,
        isStreamable: true,
        licenseOptions: licenseRows.map((license) => ({
          currency: license.currency,
          id: license.id,
          includesStems: license.includesStems,
          isExclusive: license.isExclusive,
          name: license.name,
          priceCents: license.priceCents,
          priceLabel: formatPrice(license.priceCents),
          rightsSummary: license.rightsSummary,
        })),
        musicalKey: row.musicalKey,
        priceCents,
        priceLabel: formatPrice(priceCents),
        purchaseMode: row.purchaseMode,
        slug: row.slug,
        streamCount: null,
        tags: row.genreName ? [row.genreName] : [],
        title: row.title,
        visualContent: [],
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
