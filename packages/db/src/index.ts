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

const getConnectionString = () => {
  if (env.HYPERDRIVE?.connectionString) {
    return env.HYPERDRIVE.connectionString;
  }

  const url = env.DATABASE_URL;

  if (typeof url !== "string" && url) {
    // If it's an object (like a secret wrapper), try to get the value
    // This is a safety check for different environment behaviors
    const { value } = url as unknown as { value?: string };
    if (value) {
      return value;
    }
  }

  return url?.trim() ?? "";
};

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
