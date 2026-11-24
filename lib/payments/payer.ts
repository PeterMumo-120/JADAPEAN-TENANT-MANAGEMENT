import { sql } from "drizzle-orm";
import { payerAliases } from "@/db/schema";
import { getDb } from "@/lib/db";

/** Upper-case words of 2+ letters, de-duplicated. "Wanjiku  Mwangi" -> ["WANJIKU", "MWANGI"]. */
export function nameTokens(s: string | null | undefined): string[] {
  return [...new Set((s ?? "").toUpperCase().replace(/[^A-Z]+/g, " ").split(" ").filter((w) => w.length >= 2))];
}

/** Order-insensitive name key, so "MWANGI WANJIKU" and "WANJIKU MWANGI" are the same payer. */
export const nameKey = (s: string | null | undefined) => nameTokens(s).sort().join(" ");

/** A full Kenyan number as 254XXXXXXXXX, or null for anything masked, hashed or malformed. */
export function fullPhone(m: string | null | undefined): string | null {
  if (!m || m.includes("*")) return null;
  const d = m.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(d)) return d;
  if (/^0[17]\d{8}$/.test(d)) return `254${d.slice(1)}`;
  if (/^[17]\d{8}$/.test(d)) return `254${d}`;
  return null;
}

/** The visible ends of a number: "2547 ***** 126" -> { prefix: "2547", suffix: "126" }. Works for full numbers too. */
export function maskParts(m: string | null | undefined): { prefix: string; suffix: string } | null {
  if (!m) return null;
  const s = m.replace(/\s+/g, "");
  if (s.includes("*")) {
    const prefix = s.slice(0, s.indexOf("*")).replace(/\D/g, "");
    const suffix = s.slice(s.lastIndexOf("*") + 1).replace(/\D/g, "");
    return prefix.length >= 3 && suffix.length >= 2 ? { prefix, suffix } : null;
  }
  const full = fullPhone(s);
  return full ? { prefix: full.slice(0, 4), suffix: full.slice(-3) } : null;
}

/** name + masked number. Null when either is missing, because a number alone is too weak to recognise a payer. */
export function fingerprintOf(name: string | null | undefined, msisdn: string | null | undefined): string | null {
  const k = nameKey(name);
  const mp = maskParts(msisdn);
  return k && mp ? `${k}|${mp.prefix}***${mp.suffix}` : null;
}

type Who = { shortcodeId: string; tenantId: string; payerName: string | null; msisdn: string | null };

/** The tenant confirmed (or manually assigned) a payment from this payer. Next time it is recognised. */
export async function learnPayer(w: Who): Promise<string | null> {
  const fp = fingerprintOf(w.payerName, w.msisdn);
  const mp = maskParts(w.msisdn);
  if (!fp || !mp) return null;
  await getDb().insert(payerAliases).values({
    shortcodeId: w.shortcodeId, tenantId: w.tenantId, fingerprint: fp, payerName: w.payerName, maskedMsisdn: `${mp.prefix}***${mp.suffix}`, confirmedCount: 1,
  }).onConflictDoUpdate({
    target: [payerAliases.shortcodeId, payerAliases.tenantId, payerAliases.fingerprint],
    set: { confirmedCount: sql`${payerAliases.confirmedCount} + 1`, blocked: false, lastSeenAt: new Date() },
  });
  return fp;
}

/** Undo: remember that this payer is NOT this tenant, so it is never suggested or auto-assigned to them again. */
export async function blockPayer(w: Who): Promise<string | null> {
  const fp = fingerprintOf(w.payerName, w.msisdn);
  const mp = maskParts(w.msisdn);
  if (!fp || !mp) return null;
  await getDb().insert(payerAliases).values({
    shortcodeId: w.shortcodeId, tenantId: w.tenantId, fingerprint: fp, payerName: w.payerName, maskedMsisdn: `${mp.prefix}***${mp.suffix}`, confirmedCount: 0, blocked: true,
  }).onConflictDoUpdate({
    target: [payerAliases.shortcodeId, payerAliases.tenantId, payerAliases.fingerprint],
    set: { blocked: true, confirmedCount: 0, lastSeenAt: new Date() },
  });
  return fp;
}
