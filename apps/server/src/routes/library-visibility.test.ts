import { tracks } from "@soundkit/db/schema/app";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { expect, it } from "vitest";

import { readableTrack } from "./library";

it("parenthesizes raw EXISTS subqueries and binds the viewer identity", () => {
  const query = new PgDialect().sqlToQuery(
    sql`select * from ${tracks} where ${readableTrack("viewer-id")}`
  );
  expect(query.sql.match(/exists \(select/gu)).toHaveLength(4);
  expect(query.sql).not.toContain("exists select");
  expect(query.sql).not.toContain("viewer-id");
  expect(query.params.filter((value) => value === "viewer-id")).toHaveLength(5);
  expect(query.sql).toContain("\"invitation_status\" = 'accepted'");
  expect(query.sql).toContain('"deleted_at" is null');
});

it("anonymous library visibility only considers public non-deleted tracks", () => {
  const query = new PgDialect().sqlToQuery(
    sql`select * from ${tracks} where ${readableTrack()}`
  );
  expect(query.sql).not.toContain("exists");
  expect(query.sql).toContain('"is_public" = $1');
  expect(query.sql).toContain('"deleted_at" is null');
  expect(query.params).toEqual([true]);
});
