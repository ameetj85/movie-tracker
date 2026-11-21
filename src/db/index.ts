import "server-only";

import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

type DB = BetterSQLite3Database<typeof schema>;

function createDb(): DB {
  // turbopackIgnore: these are runtime paths, not files to bundle/trace.
  const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATABASE_PATH ?? "movies.db");
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  // Local-first app: apply any pending migrations on first connection so a
  // fresh checkout (or a deleted movies.db) works without a manual step.
  migrate(db, { migrationsFolder: path.resolve(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });
  return db;
}

// Reuse a single connection across dev-server hot reloads.
const globalForDb = globalThis as unknown as { __movieDb?: DB };

export const db: DB = globalForDb.__movieDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__movieDb = db;
