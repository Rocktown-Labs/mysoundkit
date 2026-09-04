/* eslint-disable one-var, sort-vars, complexity */
/* oxlint-disable unicorn/max-nested-calls, unicorn/no-nested-ternary */
import { OpenAPIHono } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  openVerseListings,
  projectAssets,
  projectCollaborators,
  projectTracks,
  projects,
  trackAssets,
  tracks,
  userProfiles,
  videos,
} from "@soundkit/db/schema/app";
import { and, eq, like } from "drizzle-orm";

import { isAuthenticatedUser } from "@/lib/entitlements";
import { isPublicTrackArtwork } from "@/lib/media-access";
import type { AppEnv } from "@/lib/types";
import { logWarn } from "@/middleware/structured-logging";

export const objectKeyFromPath = (path: string) => {
  const prefix = "/media/";
  if (!path.startsWith(prefix)) {
    return null;
  }

  const encodedKey = path.slice(prefix.length);
  if (!encodedKey) {
    return null;
  }

  try {
    const key = decodeURIComponent(encodedKey),
      segments = key.split(/[\\/]/u);
    return key &&
      !key.startsWith("/") &&
      !segments.some((segment) => segment === "." || segment === "..")
      ? key
      : null;
  } catch {
    return null;
  }
};

const app = new OpenAPIHono<AppEnv>(),
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

const clearMissingMediaReferences = async (objectKey: string) => {
  if (!isDatabaseConfigured()) {
    return;
  }

  try {
    const db = createDb(),
      updatedAt = new Date();

    await Promise.all([
      db
        .update(userProfiles)
        .set({ avatarObjectKey: null, avatarUrl: null })
        .where(eq(userProfiles.avatarObjectKey, objectKey)),
      db
        .update(userProfiles)
        .set({ headerObjectKey: null, headerUrl: null })
        .where(eq(userProfiles.headerObjectKey, objectKey)),
      db
        .update(trackAssets)
        .set({
          isCurrent: false,
          objectKey: null,
          status: "deleted",
          updatedAt,
        })
        .where(eq(trackAssets.objectKey, objectKey)),
      db
        .update(projectAssets)
        .set({ objectKey: null, status: "deleted", updatedAt })
        .where(eq(projectAssets.objectKey, objectKey)),
    ]);

    logWarn({
      event: "missing_media_references_cleared",
      objectKey,
    });
  } catch (error) {
    logWarn({
      error: error instanceof Error ? error.message : String(error),
      event: "missing_media_reference_cleanup_failed",
      objectKey,
    });
  }
};

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
          trackRow.track.isPublic && isPublicTrackArtwork(trackRow.asset),
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
                    eq(openVerseListings.previewAssetId, trackRow.asset.id),
                    eq(openVerseListings.status, "open")
                  )
                )
                .limit(1)
            : [];
      const [projectAccess] = isAuthenticatedUser(user)
        ? await db
            .select({ id: projectTracks.projectId })
            .from(projectTracks)
            .innerJoin(
              projectCollaborators,
              eq(projectCollaborators.projectId, projectTracks.projectId)
            )
            .where(
              and(
                eq(projectTracks.trackId, trackRow.track.id),
                eq(projectCollaborators.collaboratorUserId, user.id),
                eq(projectCollaborators.invitationStatus, "accepted")
              )
            )
            .limit(1)
        : [];
      authorized =
        isOwner ||
        Boolean(projectAccess) ||
        (!privateAsset &&
          (publicArtwork || publicStreaming || Boolean(openVerse)));
    }

    if (!authorized && objectKey.startsWith("live-recordings/")) {
      const [video] = await db
        .select({
          isPublic: videos.isPublic,
          publishedAt: videos.publishedAt,
          status: videos.status,
          videoKind: videos.videoKind,
        })
        .from(videos)
        .where(
          and(
            like(videos.externalPlaybackUrl, `%${objectKey}`),
            eq(videos.isPublic, true),
            eq(videos.status, "ready")
          )
        )
        .limit(1);
      authorized = Boolean(
        video?.publishedAt &&
        (video.videoKind === "battle_replay" ||
          video.videoKind === "live_recording")
      );
    }

    if (!authorized) {
      const [projectRow] = await db
        .select({
          asset: {
            assetKind: projectAssets.assetKind,
            objectKey: projectAssets.objectKey,
          },
          project: projects,
        })
        .from(projectAssets)
        .innerJoin(projects, eq(projects.id, projectAssets.projectId))
        .where(eq(projectAssets.objectKey, objectKey))
        .limit(1);
      if (projectRow) {
        const isOwner =
            isAuthenticatedUser(user) &&
            user.id === projectRow.project.ownerUserId,
          [projectAccess] = isAuthenticatedUser(user)
            ? await db
                .select({ id: projectCollaborators.id })
                .from(projectCollaborators)
                .where(
                  and(
                    eq(projectCollaborators.projectId, projectRow.project.id),
                    eq(projectCollaborators.collaboratorUserId, user.id),
                    eq(projectCollaborators.invitationStatus, "accepted")
                  )
                )
                .limit(1)
            : [],
          publicArtwork =
            projectRow.project.isPublic &&
            projectRow.asset.assetKind === "cover_art";
        authorized = isOwner || Boolean(projectAccess) || publicArtwork;
      }
    }
  }

  if (!authorized) {
    return c.json({ message: "Media access denied." }, 403);
  }
  const object = await bucket.get(objectKey);
  if (!object) {
    c.executionCtx.waitUntil(clearMissingMediaReferences(objectKey));
    return c.json({ message: "Media not found." }, 404);
  }
  const headers = new Headers({ "Content-Length": String(object.size) });
  object.writeHttpMetadata(headers);
  headers.set(
    "Cache-Control",
    objectKey.startsWith("profiles/")
      ? "public, max-age=31536000, immutable"
      : "private, max-age=0"
  );
  headers.set("ETag", object.httpEtag);
  headers.set("Last-Modified", object.uploaded.toUTCString());
  return new Response(object.body, { headers });
});

export default app;
