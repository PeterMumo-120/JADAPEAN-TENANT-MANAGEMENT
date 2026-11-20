import { asc, eq } from "drizzle-orm";
import { shortcodes, type ShortcodeRow } from "@/db/schema";
import { getDb } from "@/lib/db";
import { decryptSecret } from "./crypto";
import type { Creds } from "./client";

export type Shortcode = ShortcodeRow;

export const typeLabel = (t: Shortcode["type"]) => (t === "till" ? "Till" : "Paybill");
export const shortcodeName = (s: Pick<Shortcode, "type" | "number" | "label">) => `${s.label} · ${typeLabel(s.type)} ${s.number}`;
export const hasKeys = (s: Pick<Shortcode, "consumerKey" | "consumerSecretEnc">) => !!(s.consumerKey && s.consumerSecretEnc);

export async function listShortcodes(opts: { activeOnly?: boolean } = {}): Promise<Shortcode[]> {
  const q = getDb().select().from(shortcodes);
  const rows = await (opts.activeOnly ? q.where(eq(shortcodes.active, true)) : q).orderBy(asc(shortcodes.label));
  return rows;
}

export async function getShortcode(id: string): Promise<Shortcode | null> {
  const [row] = await getDb().select().from(shortcodes).where(eq(shortcodes.id, id)).limit(1);
  return row ?? null;
}

export async function findShortcodeByNumber(number: string): Promise<Shortcode | null> {
  const [row] = await getDb().select().from(shortcodes).where(eq(shortcodes.number, number.trim())).limit(1);
  return row ?? null;
}

/** Decrypts the saved secret. Throws a readable error when keys are missing. */
export async function credsFor(s: Shortcode): Promise<Creds> {
  if (!s.consumerKey || !s.consumerSecretEnc) throw new Error(`${s.label} has no Daraja keys yet. Add them on its edit page.`);
  return { number: s.number, env: s.env, consumerKey: s.consumerKey, consumerSecret: await decryptSecret(s.consumerSecretEnc), nominatedNumber: s.nominatedNumber };
}
