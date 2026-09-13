import { AsyncLocalStorage } from "node:async_hooks";

/* eslint-disable one-var */
import { env } from "@soundkit/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as appSchema from "./schema/app";
import * as authSchema from "./schema/auth";
import * as commerceSchema from "./schema/commerce";
import * as communitiesSchema from "./schema/communities";
import * as paymentsSchema from "./schema/payments";
import * as plansSchema from "./schema/plans";
import * as referralsSchema from "./schema/referrals";

const schema = {
  ...appSchema,
  ...authSchema,
  ...commerceSchema,
  ...communitiesSchema,
  ...paymentsSchema,
  ...plansSchema,
  ...referralsSchema,
};

type Database = ReturnType<typeof drizzle>;

interface DatabaseScope {
  db: Database | null;
  pool: Pool | null;
}

const databaseScopeStorage = new AsyncLocalStorage<DatabaseScope>();
let fallbackDb: Database | null = null,
  fallbackPool: Pool | null = null;

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

    return new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 5000,
      max: 10,
      query_timeout: 15_000,
      statement_timeout: 12_000,
    });
  },
  createScopedDb = (scope: DatabaseScope) => {
    if (!scope.pool) {
      scope.pool = createPool();
    }

    if (!scope.db) {
      scope.db = drizzle({ client: scope.pool, schema });
    }

    return scope.db;
  };

export const createDb = () => {
  const scope = databaseScopeStorage.getStore();
  if (scope) {
    return createScopedDb(scope);
  }

  // Node scripts and database-backed tests do not have a Worker event scope.
  // Retain their historical singleton behavior while production handlers use
  // runWithDatabaseScope to prevent cross-request I/O reuse.
  if (!fallbackPool) {
    fallbackPool = createPool();
  }

  if (!fallbackDb) {
    fallbackDb = drizzle({ client: fallbackPool, schema });
  }

  return fallbackDb;
};

interface DatabaseScopeOptions {
  cleanupBarrier?: () => Promise<unknown>;
  deferCleanup?: (cleanup: Promise<void>) => void;
}

export const runWithDatabaseScope = async <T>(
  operation: () => Promise<T>,
  options: DatabaseScopeOptions = {}
): Promise<T> => {
  const existingScope = databaseScopeStorage.getStore();
  if (existingScope) {
    return await operation();
  }

  const scope: DatabaseScope = { db: null, pool: null };

  return databaseScopeStorage.run(scope, async () => {
    try {
      return await operation();
    } finally {
      const cleanup = async () => {
        await options.cleanupBarrier?.();
        await scope.pool?.end();
      };

      if (options.deferCleanup) {
        options.deferCleanup(cleanup());
      } else {
        await cleanup();
      }
    }
  });
};

export const tryCreateDb = () => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return createDb();
};

export { schema };
