import { createDb } from "@soundkit/db";
import { genres } from "@soundkit/db/schema/app";
import { eq } from "drizzle-orm";

import { canonicalGenreName, canonicalGenreSlug } from "@/lib/genre-catalog";

export const ensureGenreId = async (genreName: string) => {
  const db = createDb(),
    genreId = crypto.randomUUID(),
    genreSlug = canonicalGenreSlug(genreName),
    [genreRow] = await db
      .select({ id: genres.id })
      .from(genres)
      .where(eq(genres.slug, genreSlug))
      .limit(1);

  if (genreRow) {
    return genreRow.id;
  }

  await db.insert(genres).values({
    id: genreId,
    name: canonicalGenreName(genreName),
    slug: genreSlug,
  });

  return genreId;
};
