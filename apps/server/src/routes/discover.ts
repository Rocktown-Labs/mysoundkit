/* eslint-disable one-var, sort-vars, unicorn/max-nested-calls */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { genres, tracks, videos } from "@soundkit/db/schema/app";
import { and, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { canonicalGenreName, genreCatalog } from "@/lib/genre-catalog";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  genreCatalogSchema = z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      totalCount: z.number().int().nonnegative(),
      trackCount: z.number().int().nonnegative(),
      videoCount: z.number().int().nonnegative(),
    })
  );

app.openapi(
  createRoute({
    method: "get",
    path: "/genres",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        genreCatalogSchema,
        "Music genres catalog"
      ),
    },
    tags: ["Discover"],
  }),
  async (c) => {
    const fallbackGenres = genreCatalog.map((genre) => ({
      ...genre,
      totalCount: 0,
      trackCount: 0,
      videoCount: 0,
    }));

    if (!isDatabaseConfigured()) {
      return c.json(fallbackGenres, HttpStatusCodes.OK);
    }

    const genresBySlug = new Map(
      fallbackGenres.map((genre) => [genre.slug, genre])
    );

    try {
      const db = createDb(),
        [rows, trackCountRows, videoCountRows] = await Promise.all([
          db.select().from(genres),
          db
            .select({
              count: sql<number>`count(${tracks.id})::int`,
              genreId: tracks.genreId,
            })
            .from(tracks)
            .where(
              and(
                eq(tracks.isPublic, true),
                eq(tracks.productionStatus, "complete")
              )
            )
            .groupBy(tracks.genreId),
          db
            .select({
              count: sql<number>`count(${videos.id})::int`,
              genreId: videos.genreId,
            })
            .from(videos)
            .where(eq(videos.isPublic, true))
            .groupBy(videos.genreId),
        ]),
        countsByGenreId = new Map<
          string,
          { trackCount: number; videoCount: number }
        >();

      for (const row of trackCountRows) {
        if (!row.genreId) {
          continue;
        }
        countsByGenreId.set(row.genreId, {
          trackCount: row.count,
          videoCount: 0,
        });
      }

      for (const row of videoCountRows) {
        if (!row.genreId) {
          continue;
        }
        const current = countsByGenreId.get(row.genreId) ?? {
          trackCount: 0,
          videoCount: 0,
        };
        countsByGenreId.set(row.genreId, {
          ...current,
          videoCount: row.count,
        });
      }

      for (const row of rows) {
        const counts = countsByGenreId.get(row.id) ?? {
          trackCount: 0,
          videoCount: 0,
        };
        genresBySlug.set(row.slug, {
          id: row.id,
          name: canonicalGenreName(row.name),
          slug: row.slug,
          totalCount: counts.trackCount + counts.videoCount,
          ...counts,
        });
      }
    } catch {
      // Keep discovery usable while the additive genre table is rolling out.
    }

    return c.json([...genresBySlug.values()], HttpStatusCodes.OK);
  }
);

export default app;
