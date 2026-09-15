import path from "node:path";
import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

type G = { __cwlDb?: Promise<DB> };
const g = globalThis as G;

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    // prepare:false keeps it compatible with Supabase's transaction pooler.
    const client = postgres(url, { prepare: false, max: 5 });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as DB;
  }
  // Local development without a DATABASE_URL: embedded Postgres stored in ./.data
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite"));
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!g.__cwlDb) {
    g.__cwlDb = create().catch((e) => {
      g.__cwlDb = undefined;
      throw e;
    });
  }
  return g.__cwlDb;
}

export { schema };
