import { eq, inArray } from "drizzle-orm";
import { payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { normaliseRef } from "@/lib/format";
import { applyLoaded, loadPaybillTenants, newBudget, type Budget } from "@/lib/payments/allocate";
import { fullPhone } from "@/lib/payments/payer";
import { decide, loadTillContext } from "@/lib/payments/till-match";
import type { PullTransaction } from "./client";
import { findShortcodeByNumber, type Shortcode } from "./shortcodes";

export type IncomingPayment = {
  receipt: string; amount: number; billRef: string | null; msisdn: string | null; shortCode: string | null;
  payerName: string | null; paidAt: Date; source: "c2b" | "reconcile"; raw: unknown;
};

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");

/** "20231121121325" is Nairobi time (confirmed by Safaricom: all webhook timestamps are EAT). */
function parseTransTime(s: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 3, +m[5], +m[6])) : new Date();
}
/** Safaricom sends every timestamp in Nairobi time, even when a Pull date ends in "Z", so a bare "Z" or no offset means +03:00. */
function parseIso(s: string): Date {
  const d = new Date(/[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(/[zZ]$/, "")}+03:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Webhook payload (Confirmation URL). Returns null when it has no usable receipt or amount. */
export function fromC2B(p: Record<string, unknown>): IncomingPayment | null {
  const receipt = str(p.TransID);
  const amount = Math.round(Number(p.TransAmount));
  if (!receipt || !Number.isFinite(amount) || amount <= 0) return null;
  const name = [p.FirstName, p.MiddleName, p.LastName].map(str).filter(Boolean).join(" ");
  return { receipt, amount, billRef: str(p.BillRefNumber) || null, msisdn: str(p.MSISDN) || null, shortCode: str(p.BusinessShortCode) || null, payerName: name || null,
    paidAt: parseTransTime(str(p.TransTime)), source: "c2b", raw: p };
}

/** Pull API item. It has no payer name, and msisdn is just an opaque string. We know the shortcode because we pulled it. */
export function fromPull(t: PullTransaction, shortCode: string): IncomingPayment | null {
  const receipt = str(t.transactionId);
  const amount = Math.round(Number(t.amount));
  if (!receipt || !Number.isFinite(amount) || amount <= 0) return null;
  return { receipt, amount, billRef: str(t.billreference) || null, msisdn: str(t.msisdn) || null, shortCode, payerName: null,
    paidAt: parseIso(str(t.trxDate)), source: "reconcile", raw: t };
}

const chunk = <T,>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export type IngestResult = { inserted: number; matched: number; deferred: number };

/**
 * Stores many payments with a FIXED number of database calls, however many there are:
 *   1 query per 90 receipts to find which already exist, 1 batch for all the inserts, 1 query to load the
 *   tenants (and 1 more for a till's learned payers), then one batch per payment that gets assigned.
 * That keeps a busy sync inside the free plan's per-request database limit.
 *
 * PAYBILL shortcodes match by account number. TILL shortcodes use the till matcher (learned payers, phone, name, amount)
 * according to the shortcode's match mode. At most `budget.left` payments are assigned per call; the rest stay
 * unmatched and are picked up by the next run (`rematchUnmatched`).
 */
export async function ingestMany(sc: Shortcode | null, incs: IncomingPayment[], budget: Budget = newBudget()): Promise<IngestResult> {
  const out: IngestResult = { inserted: 0, matched: 0, deferred: 0 };
  const unique = new Map<string, IncomingPayment>();
  for (const i of incs) if (!unique.has(i.receipt)) unique.set(i.receipt, i);
  const list = [...unique.values()];
  if (!list.length) return out;
  const db = getDb();

  // 1. Which receipts do we already have?
  type Existing = { id: string; payerName: string | null; status: "matched" | "unmatched" | "ignored"; amount: number; matchReason: string | null };
  const existing = new Map<string, Existing>();
  for (const part of chunk(list.map((i) => i.receipt), 90)) {
    const rows = await db.select({ id: payments.id, receipt: payments.mpesaReceipt, payerName: payments.payerName, status: payments.status, amount: payments.amount, matchReason: payments.matchReason })
      .from(payments).where(inArray(payments.mpesaReceipt, part));
    for (const r of rows) existing.set(r.receipt, r);
  }

  // 2. Insert the new ones, 8 rows per statement (D1 allows 100 bound parameters), all in one batch.
  const fresh = list.filter((i) => !existing.has(i.receipt));
  const stored: { id: string; inc: IncomingPayment }[] = [];
  if (fresh.length) {
    const byReceipt = new Map(fresh.map((i) => [i.receipt, i]));
    const stmts = chunk(fresh, 8).map((c) => db.insert(payments).values(c.map((inc) => ({
      mpesaReceipt: inc.receipt, amount: inc.amount, billRef: inc.billRef, msisdnHash: inc.msisdn, payerName: inc.payerName,
      shortcodeId: sc?.id ?? null, shortcodeNumber: inc.shortCode, paidAt: inc.paidAt, source: inc.source, raw: JSON.stringify(inc.raw),
    }))).onConflictDoNothing().returning({ id: payments.id, receipt: payments.mpesaReceipt }));
    const res = (await db.batch(stmts as unknown as [(typeof stmts)[number], ...(typeof stmts)[number][]])) as unknown as { id: string; receipt: string }[][];
    for (const row of res.flat()) { const inc = byReceipt.get(row.receipt); if (inc) stored.push({ id: row.id, inc }); }
  }
  out.inserted = stored.length;

  // 3. A webhook arriving after Pull is the only source of the payer's name.
  const nameFixes = list.filter((i) => i.payerName && existing.get(i.receipt) && !existing.get(i.receipt)!.payerName);
  for (const i of nameFixes) await db.update(payments).set({ payerName: i.payerName }).where(eq(payments.id, existing.get(i.receipt)!.id));

  if (!sc) return out;

  // 4. Matching
  if (sc.type === "paybill") {
    const targets = stored.filter((x) => x.inc.billRef);
    if (!targets.length) return out;
    const map = await loadPaybillTenants(sc.id);
    for (const x of targets) {
      const key = normaliseRef(x.inc.billRef!);
      const t = map.get(key);
      if (!t) continue;
      if (budget.left <= 0) { out.deferred++; continue; }
      const next = await applyLoaded({ id: x.id, amount: x.inc.amount }, t, { method: "account" });
      if (next) { map.set(key, next); out.matched++; budget.left--; }
    }
    return out;
  }

  // Till: new payments, plus older unmatched ones that this Pull reveals the FULL phone number for.
  if (sc.matchMode === "off") return out;
  type Job = { id: string; amount: number; payerName: string | null; msisdn: string | null; exclude: string[]; isNew: boolean };
  const jobs: Job[] = stored.map((x) => ({ id: x.id, amount: x.inc.amount, payerName: x.inc.payerName, msisdn: x.inc.msisdn, exclude: [], isNew: true }));
  for (const i of list) {
    const e = existing.get(i.receipt);
    if (e && e.status === "unmatched" && fullPhone(i.msisdn)) {
      jobs.push({ id: e.id, amount: e.amount, payerName: e.payerName ?? i.payerName, msisdn: i.msisdn, isNew: false,
        exclude: e.matchReason?.startsWith("undone:") ? e.matchReason.slice(7).split(",") : [] });
    }
  }
  if (!jobs.length) return out;

  const ctx = await loadTillContext(sc.id, sc.matchMode);
  const evaluated: string[] = [];
  for (const j of jobs) {
    if (budget.left <= 0) { if (j.isNew) out.deferred++; continue; }
    const d = decide(ctx, { amount: j.amount, payerName: j.payerName, msisdn: j.msisdn, excludeTenantIds: j.exclude });
    if (j.isNew) evaluated.push(j.id);
    const t = d.auto ? ctx.tenants.find((x) => x.id === d.auto!.tenantId) : undefined;
    if (!d.auto || !t) continue;
    const next = await applyLoaded({ id: j.id, amount: j.amount }, t, { method: d.auto.method, reason: d.auto.reason });
    if (next) { Object.assign(t, next); out.matched++; budget.left--; }
  }
  if (evaluated.length) await db.update(payments).set({ autoTried: true }).where(inArray(payments.id, evaluated));
  return out;
}

/** One payment from the webhook. Returns whether it was new. */
export async function ingestPayment(inc: IncomingPayment, known?: Shortcode | null): Promise<{ inserted: boolean; shortcode: Shortcode | null }> {
  const sc = known ?? (inc.shortCode ? await findShortcodeByNumber(inc.shortCode) : null);
  const r = await ingestMany(sc, [inc]);
  return { inserted: r.inserted > 0, shortcode: sc };
}
