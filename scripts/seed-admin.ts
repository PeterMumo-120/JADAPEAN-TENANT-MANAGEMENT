/**
 * Creates the FIRST admin (already approved). Everyone after that registers on the
 * sign-in page and is approved by an existing admin from the Admins page.
 *
 * Usage (pick ONE target flag):
 *   bun run db:seed:admin "First" "Last" "0712345678" --dev      local SQLite file (DATABASE_URL in .env)
 *   bun run db:seed:admin "First" "Last" "0712345678" --local    wrangler's local D1 (what `bun run preview` uses)
 *   bun run db:seed:admin "First" "Last" "0712345678" --remote   production D1 (run once)
 *   bun run db:seed:admin "First" "Last" "0712345678" "MyOwnPasscode" --remote
 *
 * - Without a flag it only PRINTS the SQL (nothing is written).
 * - If you don't pass a passcode, a strong one is generated and printed ONCE.
 * - Migrations must be applied first (db:migrate:dev / db:migrate).
 */
import { $ } from "bun";
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { hashPasscode } from "../lib/passcode";
import { normalisePhone } from "../lib/phone";

const args = process.argv.slice(2);
const target = (["dev", "local", "remote"] as const).find((t) => args.includes(`--${t}`)) ?? null;
const [firstName, lastName, rawPhone, givenPasscode] = args.filter((a) => !a.startsWith("--"));

const fail = (msg: string): never => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

if (!firstName || !lastName || !rawPhone) {
  fail('Usage: bun run db:seed:admin "First" "Last" "0712345678" [passcode] --dev|--local|--remote');
}

const phone = normalisePhone(rawPhone) ?? fail(`"${rawPhone}" is not a valid Kenyan phone number.`);

function generatePasscode(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // no look-alikes
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const passcode = givenPasscode ?? generatePasscode();
if (passcode.length < 8) fail("Passcode must be at least 8 characters.");

const { hash, salt } = await hashPasscode(passcode);
const id = crypto.randomUUID();
const first = firstName.trim();
const last = lastName.trim();

const q = (s: string) => `'${s.replace(/'/g, "''")}'`; // SQL string literal (wrangler paths only)
const sql =
  `INSERT INTO admins (id, first_name, last_name, phone, passcode_hash, passcode_salt, status, approved_at) ` +
  `VALUES (${q(id)}, ${q(first)}, ${q(last)}, ${q(phone)}, ${q(hash)}, ${q(salt)}, 'approved', unixepoch());`;

if (target === "dev") {
  // Plain SQLite file, through Bun's built-in driver (no extra package). Parameterised, no string SQL.
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is not set. Add it to .env (see .env.example).");
  const file = url!.replace(/^file:/, "");
  if (!existsSync(file)) fail(`${file} does not exist yet. Run: bun run db:migrate:dev`);
  const db = new Database(file);
  try {
    db.query(
      `INSERT INTO admins (id, first_name, last_name, phone, passcode_hash, passcode_salt, status, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', unixepoch())`,
    ).run(id, first, last, phone, hash, salt);
  } catch (e) {
    fail(`Insert failed: ${(e as Error).message}\n  Are migrations applied, and is this phone already registered?`);
  } finally {
    db.close();
  }
} else if (target) {
  try {
    await $`bunx wrangler d1 execute DB ${`--${target}`} --command ${sql}`;
  } catch {
    fail("Insert failed. Have migrations been applied, and is this phone already registered?");
  }
} else {
  console.log(sql);
}

// stderr, so redirecting stdout (> file) never captures the passcode.
console.error(`\n✔ Admin ready: ${first} ${last} (${phone}), approved${target ? ` on ${target}` : " (SQL printed only)"}`);
if (!givenPasscode) console.error(`  Passcode: ${passcode}\n  Save it now. It cannot be shown again.\n`);
