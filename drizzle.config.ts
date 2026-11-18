import { defineConfig } from "drizzle-kit";

/**
 * PRODUCTION config (Cloudflare D1 over HTTP).
 *
 * Used for:
 *  - `bun run db:generate`      → writes SQL migration files into ./drizzle (no DB connection needed)
 *  - `bun run db:studio` → browse production data (needs the CLOUDFLARE_* vars below in your local .env)
 *
 * Migrations are NEVER applied with drizzle-kit. They are applied by
 * `wrangler d1 migrations apply DB --remote`, which runs in the Cloudflare build on every push.
 * Do not add or run `drizzle-kit push` / `drizzle-kit migrate` against this config.
 */
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
