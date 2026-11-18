import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

/**
 * DEV config: a plain local SQLite file, set by DATABASE_URL in .env.
 *
 *   bun run db:migrate:dev   applies ./drizzle to that file
 *   bun run db:studio:dev    browse it
 *
 * Migration files are the same ones production applies to D1. Never use `push`.
 */
const url = process.env.DATABASE_URL ?? "file:./dev.db";
const file = url.replace(/^file:/, "");
if (url.startsWith("file:")) fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });

export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
