/* eslint-disable one-var, sort-vars */
import { OpenAPIHono } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  openVerseListings,
  projectAssets,
  projects,
  trackAssets,
  tracks,
} from "@soundkit/db/schema/app";
import { and, eq } from "drizzle-orm";

import { isAuthenticatedUser } from "@/lib/entitlements";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  objectKeyFromPath = (path: string) => {
    const prefix = "/media/";
    if (!path.startsWith(prefix)) {
      return null;
    }
    const key = path.slice(prefix.length);
    return key && !key.includes("../") ? key : null;
  },
  isPrivateTrackAsset = (asset: typeof trackAssets.$inferSelect) =>
    asset.purpose === "master" ||
    asset.purpose === "stem" ||
    asset.purpose === "download" ||
    asset.purpose === "lossless_download" ||
    asset.assetKind === "master" ||
    asset.assetKind === "vocal_stem" ||
    asset.assetKind === "stems" ||
    asset.assetKind === "session_file" ||
    asset.assetKind === "verse_vocal" ||
    asset.assetKind === "adlib" ||
    asset.assetKind === "reference_audio";

app.get("/*", async (c) => {
  const objectKey = objectKeyFromPath(c.req.path),
    bucket = c.env.MEDIA_BUCKET;
  if (!(objectKey && bucket)) {
    return c.json({ message: "Media not found." }, 404);
  }

  let authorized = objectKey.startsWith("profiles/");
  if (isDatabaseConfigured() && !authorized) {
    const db = createDb(),
      user = c.get("user"),
      [trackRow] = await db
        .select({ asset: trackAssets, track: tracks })
        .from(trackAssets)
        .innerJoin(tracks, eq(tracks.id, trackAssets.trackId))
        .where(eq(trackAssets.objectKey, objectKey))
        .limit(1);
    if (trackRow) {
      const isOwner =
          isAuthenticatedUser(user) && user.id === trackRow.track.ownerUserId,
        privateAsset = isPrivateTrackAsset(trackRow.asset),
        publicArtwork =
          trackRow.track.isPublic && trackRow.asset.purpose === "artwork",
        publicStreaming =
          trackRow.track.isPublic &&
          trackRow.track.listeningAccess === "public" &&
          trackRow.asset.purpose === "streaming",
        [openVerse] =
          trackRow.asset.purpose === "open_verse_snippet"
            ? await db
                .select({ id: openVerseListings.id })
                .from(openVerseListings)
                .where(
                  and(
                    eq(
                      openVerseListings.previewAssetId,
                      trackRow.asset.id
                    ),
                    eq(openVerseListings.status, "open")
                  )
                )
                .limit(1)
            : [];
      authorized = isOwner || (!privateAsset && (publicArtwork || publicStreaming || Boolean(openVerse)));
    }

    if (!authorized) {
      const [projectRow] = await db
        .select({ asset: projectAssets, project: projects })
        .from(projectAssets)
        .innerJoin(projects, eq(projects.id, projectAssets.projectId))
        .where(eq(projectAssets.objectKey, objectKey))
        .limit(1);
      if (projectRow) {
        const isOwner =
            isAuthenticatedUser(user) &&
            user.id === projectRow.project.ownerUserId,
          publicArtwork =
            projectRow.project.isPublic &&
            projectRow.asset.assetKind === "cover_art";
        authorized = isOwner || publicArtwork;
      }
    }
  }

  if (!authorized) {
    return c.json({ message: "Media access denied." }, 403);
  }
  const object = await bucket.get(objectKey);
  if (!object) {
    return c.json({ message: "Media not found." }, 404);
  }
  const headers = new Headers({
    "Cache-Control": "public, max-age=3600",
    "Content-Length": String(object.size),
  });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
});

export default app;
