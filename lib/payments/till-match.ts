import { and, eq } from "drizzle-orm";
import { buildings, payerAliases, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { rentSummary } from "@/lib/tenants/status";
import { fingerprintOf, fullPhone, maskParts, nameTokens } from "./payer";

export type MatchMode = "off" | "balanced" | "strict";
export type AutoMethod = "learned" | "scored" | "phone";

export type TillTenant = {
  id: string; name: string; phone: string; rentAmount: number; moveInDate: string; paidThrough: string | null; creditBalance: number;
  balance: number; buildingId: string; buildingName: string; houseNo: string | null;
  nameTokens: string[]; extraNumbers: string[]; // from "also pays from"
};
export type TillAlias = { id: string; tenantId: string; fingerprint: string; blocked: boolean; confirmedCount: number };
export type TillContext = { shortcodeId: string; mode: MatchMode; tenants: TillTenant[]; aliases: TillAlias[] };

export type PaymentFacts = { amount: number; payerName: string | null; msisdn: string | null; excludeTenantIds?: string[] };
export type Candidate = { tenantId: string; score: number; reasons: string[]; nameHit: boolean; digitsHit: boolean };
export type Decision = {
  auto: { tenantId: string; method: AutoMethod; reason: string } | null;
  candidates: Candidate[]; // best first, at most 3
  ambiguousPayer: boolean; // this payer is already known for more than one tenant
};

type TenantRow = typeof tenants.$inferSelect;

/** Splits "also pays from" into names and phone numbers: "Peter Kamau, 0722 111 126". */
function parseAlso(text: string | null): { tokens: string[]; numbers: string[] } {
  const tokens: string[] = [];
  const numbers: string[] = [];
  for (const piece of (text ?? "").split(/[,;\n]/)) {
    if (/\d{7,}/.test(piece.replace(/\s+/g, ""))) { const n = fullPhone(piece); if (n) numbers.push(n); }
    else tokens.push(...nameTokens(piece));
  }
  return { tokens, numbers };
}

export function buildTillContext(shortcodeId: string, mode: MatchMode, rows: { t: TenantRow; buildingName: string }[], aliases: TillAlias[]): TillContext {
  return {
    shortcodeId, mode, aliases,
    tenants: rows.map(({ t, buildingName }) => {
      const also = parseAlso(t.alsoPaysFrom);
      return {
        id: t.id, name: t.name, phone: t.phone, rentAmount: t.rentAmount, moveInDate: t.moveInDate, paidThrough: t.paidThrough, creditBalance: t.creditBalance,
        balance: rentSummary(t).balance, buildingId: t.buildingId, buildingName, houseNo: t.houseNo,
        nameTokens: [...new Set([...nameTokens(t.name), ...also.tokens])], extraNumbers: also.numbers,
      };
    }),
  };
}

/** Two queries: the till's active tenants and what has been learned about its payers. */
export async function loadTillContext(shortcodeId: string, mode: MatchMode): Promise<TillContext> {
  const db = getDb();
  const [rows, aliasRows] = await Promise.all([
    db.select({ t: tenants, buildingName: buildings.name }).from(tenants).innerJoin(buildings, eq(tenants.buildingId, buildings.id))
      .where(and(eq(tenants.status, "active"), eq(buildings.shortcodeId, shortcodeId))),
    db.select().from(payerAliases).where(eq(payerAliases.shortcodeId, shortcodeId)),
  ]);
  return buildTillContext(shortcodeId, mode, rows, aliasRows);
}

const phonesOf = (t: TillTenant) => [t.phone, ...t.extraNumbers];

function score(t: TillTenant, f: PaymentFacts, payerTokens: string[], parts: ReturnType<typeof maskParts>, full: string | null): Candidate {
  const reasons: string[] = [];
  let s = 0;

  const shared = payerTokens.filter((w) => t.nameTokens.includes(w)).length;
  if (shared >= 2) { s += 50; reasons.push("full name"); } else if (shared === 1) { s += 20; reasons.push("name"); }

  let digitsHit = false;
  if (full && phonesOf(t).includes(full)) { s += 40; reasons.push("phone number"); digitsHit = true; }
  else if (parts && phonesOf(t).some((p) => p.startsWith(parts.prefix) && p.endsWith(parts.suffix))) { s += 30; reasons.push("phone digits"); digitsHit = true; }

  if (f.amount === t.rentAmount) { s += 15; reasons.push("rent amount"); }
  else if (f.amount % t.rentAmount === 0 && f.amount / t.rentAmount >= 2 && f.amount / t.rentAmount <= 12) { s += 10; reasons.push("multiple of rent"); }

  if (t.balance > 0) { s += 5; reasons.push("rent due"); }
  return { tenantId: t.id, score: s, reasons, nameHit: shared > 0, digitsHit };
}

const BALANCED_MIN = 55; // score needed to auto-assign in Balanced mode
const BALANCED_LEAD = 25; // and how far ahead of the runner-up it must be

/**
 * Decides who (if anyone) a till payment belongs to. Pure: no database access.
 *  - Learned payer (confirmed before for exactly one tenant) -> assign.
 *  - Full phone number equal to exactly one tenant's (only available from the Pull sync) -> assign.
 *  - Strict: name AND phone digits both match exactly one tenant. Balanced: a clear score lead.
 *  - Anyone the payer was undone from is excluded. A payer known for several tenants is never auto-assigned.
 * Mode "off" never assigns, but candidates are still returned so the inbox can suggest.
 */
export function decide(ctx: TillContext, f: PaymentFacts): Decision {
  const fp = fingerprintOf(f.payerName, f.msisdn);
  const blocked = new Set(fp ? ctx.aliases.filter((a) => a.fingerprint === fp && a.blocked).map((a) => a.tenantId) : []);
  const skip = new Set(f.excludeTenantIds ?? []);
  const pool = ctx.tenants.filter((t) => !blocked.has(t.id) && !skip.has(t.id));
  const parts = maskParts(f.msisdn);
  const full = fullPhone(f.msisdn);
  const payerTokens = nameTokens(f.payerName);

  const candidates = pool.map((t) => score(t, f, payerTokens, parts, full)).filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
  const learnedRows = fp ? ctx.aliases.filter((a) => a.fingerprint === fp && !a.blocked && pool.some((t) => t.id === a.tenantId)) : [];
  const learnedIds = [...new Set(learnedRows.map((a) => a.tenantId))];
  const ambiguousPayer = learnedIds.length > 1;

  let auto: Decision["auto"] = null;
  if (ctx.mode !== "off" && !ambiguousPayer) {
    if (learnedIds.length === 1) {
      const n = learnedRows.filter((a) => a.tenantId === learnedIds[0]).reduce((x, a) => x + a.confirmedCount, 0);
      auto = { tenantId: learnedIds[0], method: "learned", reason: `known payer (confirmed ${n} time${n === 1 ? "" : "s"})` };
    } else {
      const exact = full ? pool.filter((t) => phonesOf(t).includes(full)) : [];
      if (exact.length === 1) {
        auto = { tenantId: exact[0].id, method: "phone", reason: "full phone number" };
      } else if (exact.length === 0) {
        const [top, second] = candidates;
        if (ctx.mode === "strict") {
          const both = candidates.filter((c) => c.nameHit && c.digitsHit);
          if (both.length === 1) auto = { tenantId: both[0].tenantId, method: "scored", reason: both[0].reasons.join(" + ") };
        } else if (top && top.score >= BALANCED_MIN && (!second || top.score - second.score >= BALANCED_LEAD)) {
          auto = { tenantId: top.tenantId, method: "scored", reason: top.reasons.join(" + ") };
        }
      }
    }
  }
  return { auto, candidates: candidates.slice(0, 3), ambiguousPayer };
}
