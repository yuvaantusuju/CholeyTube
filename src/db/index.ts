import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Lightweight wrapper that lazily initializes the pg pool. We tolerate a
 * missing DATABASE_URL (e.g. local dev) by exposing a noop `db` stub so the
 * app still renders. Routes that actually need the database should use
 * `getDb()` and handle the null case.
 */
type DbOrNull = ReturnType<typeof drizzle> | null;

const globalForDb = globalThis as typeof globalThis & {
  __choleytubePool?: Pool;
  __choleytubeDb?: DbOrNull;
};

function tryCreatePool(): Pool | null {
  if (globalForDb.__choleytubePool) return globalForDb.__choleytubePool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const pool = new Pool({ connectionString: url });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__choleytubePool = pool;
  }
  return pool;
}

function buildDb() {
  const pool = tryCreatePool();
  if (!pool) return null;
  return drizzle(pool);
}

export function getDb(): DbOrNull {
  if (globalForDb.__choleytubeDb !== undefined) return globalForDb.__choleytubeDb;
  const db = buildDb();
  globalForDb.__choleytubeDb = db;
  return db;
}

// Default export keeps the old `@/db` import working for existing code paths
// (e.g. /api/health). It is null if DATABASE_URL isn't set.
export const db = getDb() as NonNullable<DbOrNull>;
