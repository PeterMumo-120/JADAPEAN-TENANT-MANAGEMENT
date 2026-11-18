import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/db/schema";
import type { D1Database } from "@cloudflare/workers-types";

/**
 * One typed database for the whole app.
 *  - `next dev`            -> local SQLite file from DATABASE_URL (via libSQL)
 *  - everything else       -> the Cloudflare D1 binding named DB (production, and `bun run preview`)
 *
 * Both are SQLite with the same migration files. The libSQL database is typed as D1 so the rest of
 * the code never has to care which one it is. Use db.batch([...]) instead of transactions on both.
 */
export type Db = DrizzleD1Database<typeof schema>;

const g = globalThis as unknown as { __devDb?: Db };

export function getDb(): Db {
  // `process.env.NODE_ENV` is replaced at build time, so in production builds this whole branch
  // (and the @libsql/client import inside it) is removed and never reaches the Worker bundle.
  if (process.env.NODE_ENV === "development") {
    if (!g.__devDb) {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL is not set. Add it to .env (see .env.example).");
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { createClient } = require("@libsql/client");
      const { drizzle: drizzleLibsql } = require("drizzle-orm/libsql");
      /* eslint-enable @typescript-eslint/no-require-imports */
      g.__devDb = drizzleLibsql(createClient({ url }), { schema }) as unknown as Db; // cached across hot reloads
    }
    return g.__devDb;
  }

  const binding = (getCloudflareContext().env as unknown as { DB?: D1Database }).DB;
  if (!binding) throw new Error("The D1 binding DB is missing. Check d1_databases in wrangler.jsonc.");
  return drizzle(binding, { schema });
}
