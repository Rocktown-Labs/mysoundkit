import { env } from "@soundkit/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as appSchema from "./schema/app";
import * as authSchema from "./schema/auth";

const schema = {
  ...appSchema,
  ...authSchema,
};

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

const getConnectionString = () => env.DATABASE_URL?.trim() ?? "";

export const isDatabaseConfigured = () => getConnectionString().length > 0;

const createPool = () => {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      maxUses: 1,
    });
  }

  return pool;
};

export const createDb = () => {
  if (!db) {
    db = drizzle({ client: createPool(), schema });
  }

  return db;
};

export const tryCreateDb = () => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return createDb();
};

export { schema };
