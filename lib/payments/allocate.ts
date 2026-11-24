import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { buildings, paymentAllocations, payments, shortcodes, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { normaliseRef } from "@/lib/format";
import { decide, loadTillContext } from "./till-match";

export function nextPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
export function prevPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export type MatchMethod = "account" | "learned" | "scored" | "phone" | "manual";
export type TenantState = { id: string; rentAmount: number; moveInDate: string; paidThrough: string | null; creditBalance: number };

/**
 * Work budget for ONE invocation. A Worker on the free plan may make only ~50 database calls per request, so bulk
 * work (sync, re-matching) stops after this many applied payments. Anything left over stays unmatched and is picked up
 * by the next run.
 */
export type Budget = { left: number };
export const newBudget = (n = 20): Budget => ({ left: n });

const chunk = <T,>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const ALLOC_CHUNK = 15; // D1 allows at most 100 bound parameters per statement

/** Pure: which months a payment pays, oldest unpaid month first, and the tenant's resulting state. */
export function planAllocation(t: TenantState, amount: number) {
  let paid = t.paidThrough ?? prevPeriod(t.moveInDate.slice(0, 7));
  let credit = t.creditBalance;
  let remaining = amount;
  const allocs: { period: string; amount: number }[] = [];
  while (remaining > 0 && allocs.length < 24) {
    const period = nextPeriod(paid);
    const need = t.rentAmount - credit;
    if (need <= 0) { paid = period; credit = 0; continue; }
    const take = Math.min(remaining, need);
    allocs.push({ period, amount: take });
    remaining -= take;
    if (take === need) { paid = period; credit = 0; } else { credit += take; }
  }
  return { allocs, paidThrough: paid, creditBalance: credit };
}

/**
 * Applies one payment to an already-loaded tenant in a single database batch (one round trip).
 * `paidThrough` is the last fully paid month; `creditBalance` is what has been paid toward the month after it.
 * Returns the tenant's new state, or null if nothing could be allocated.
 */
export async function applyLoaded(
  pay: { id: string; amount: number }, t: TenantState, meta: { method: MatchMethod; reason?: string | null } = { method: "manual" },
): Promise<TenantState | null> {
  const plan = planAllocation(t, pay.amount);
  if (!plan.allocs.length) return null;
  const db = getDb();
  const rows = plan.allocs.map((a) => ({ paymentId: pay.id, tenantId: t.id, ...a }));
  const stmts = [
    ...chunk(rows, ALLOC_CHUNK).map((c) => db.insert(paymentAllocations).values(c)),
    db.update(tenants).set({ paidThrough: plan.paidThrough, creditBalance: plan.creditBalance, updatedAt: new Date() }).where(eq(tenants.id, t.id)),
    db.update(payments).set({ tenantId: t.id, status: "matched", matchMethod: meta.method, matchReason: meta.reason ?? null, autoTried: true }).where(eq(payments.id, pay.id)),
  ];
  await db.batch(stmts as unknown as [(typeof stmts)[number], ...(typeof stmts)[number][]]);
  return { ...t, paidThrough: plan.paidThrough, creditBalance: plan.creditBalance };
}

/** Same as applyLoaded but loads the payment and tenant first (for single, user-driven actions). */
export async function applyPayment(
  paymentId: string, tenantId: string, meta: { method: MatchMethod; reason?: string | null } = { method: "manual" },
): Promise<"matched" | "already" | "missing"> {
  const db = getDb();
  const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!pay || !t) return "missing";
  if (pay.status === "matched") return "already";
  return (await applyLoaded(pay, t, meta)) ? "matched" : "missing";
}

/**
 * Recomputes a tenant's allocations from scratch by replaying their matched payments in order. Used after a payment is
 * released (Undo), because later payments may need to move earlier to fill the gap.
 */
export async function replayTenant(tenantId: string): Promise<void> {
  const db = getDb();
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!t) return;
  const pays = await db.select().from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.status, "matched"))).orderBy(asc(payments.paidAt), asc(payments.createdAt));
  let state: TenantState = { id: t.id, rentAmount: t.rentAmount, moveInDate: t.moveInDate, paidThrough: null, creditBalance: 0 };
  const rows: { paymentId: string; tenantId: string; period: string; amount: number }[] = [];
  for (const p of pays) {
    const plan = planAllocation(state, p.amount);
    plan.allocs.forEach((a) => rows.push({ paymentId: p.id, tenantId, ...a }));
    state = { ...state, paidThrough: plan.paidThrough, creditBalance: plan.creditBalance };
  }
  const stmts = [
    db.delete(paymentAllocations).where(eq(paymentAllocations.tenantId, tenantId)),
    ...chunk(rows, ALLOC_CHUNK).map((c) => db.insert(paymentAllocations).values(c)),
    db.update(tenants).set({ paidThrough: pays.length ? state.paidThrough : null, creditBalance: pays.length ? state.creditBalance : 0, updatedAt: new Date() }).where(eq(tenants.id, tenantId)),
  ];
  await db.batch(stmts as unknown as [(typeof stmts)[number], ...(typeof stmts)[number][]]);
}

/** Puts a matched payment back in the inbox and recomputes the tenant. Returns the tenant it was released from. */
export async function releasePayment(paymentId: string): Promise<string | null> {
  const db = getDb();
  const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!pay || pay.status !== "matched" || !pay.tenantId) return null;
  // "undone:<tenantId,...>" lets later matching skip tenants this payment was taken away from, even without a payer name.
  const undone = [...(pay.matchReason?.startsWith("undone:") ? pay.matchReason.slice(7).split(",") : []), pay.tenantId];
  await db.update(payments).set({ tenantId: null, status: "unmatched", matchMethod: null, matchReason: `undone:${[...new Set(undone)].join(",")}`, autoTried: true }).where(eq(payments.id, paymentId));
  await replayTenant(pay.tenantId);
  return pay.tenantId;
}

/** Active tenants under a PAYBILL keyed by their normalised account number. One query. */
export async function loadPaybillTenants(shortcodeId: string): Promise<Map<string, TenantState>> {
  const rows = await getDb().select({
    ref: tenants.accountRef, id: tenants.id, rentAmount: tenants.rentAmount, moveInDate: tenants.moveInDate, paidThrough: tenants.paidThrough, creditBalance: tenants.creditBalance,
  }).from(tenants).innerJoin(buildings, eq(tenants.buildingId, buildings.id)).where(and(eq(tenants.status, "active"), eq(buildings.shortcodeId, shortcodeId)));
  const map = new Map<string, TenantState>();
  for (const r of rows) if (r.ref) map.set(normaliseRef(r.ref), { id: r.id, rentAmount: r.rentAmount, moveInDate: r.moveInDate, paidThrough: r.paidThrough, creditBalance: r.creditBalance });
  return map;
}

/**
 * Retries unmatched payments, oldest first, within a budget:
 *  1. links payments whose shortcode was added after they arrived;
 *  2. PAYBILL payments: match by account number (a tenant may have been added since);
 *  3. TILL payments that auto-matching has not looked at yet (e.g. the budget ran out earlier).
 */
export async function rematchUnmatched(budget: Budget = newBudget(15)): Promise<number> {
  const db = getDb();
  const all = await db.select().from(shortcodes);
  const byNumber = new Map(all.map((s) => [s.number, s]));
  const byId = new Map(all.map((s) => [s.id, s]));

  const orphans = await db.select({ id: payments.id, number: payments.shortcodeNumber }).from(payments)
    .where(and(eq(payments.status, "unmatched"), isNull(payments.shortcodeId), isNotNull(payments.shortcodeNumber))).limit(50);
  for (const o of orphans) {
    const sc = o.number ? byNumber.get(o.number) : undefined;
    if (sc) await db.update(payments).set({ shortcodeId: sc.id }).where(eq(payments.id, o.id));
  }

  const pending = await db.select({
    id: payments.id, amount: payments.amount, billRef: payments.billRef, shortcodeId: payments.shortcodeId, payerName: payments.payerName, msisdn: payments.msisdnHash, autoTried: payments.autoTried, matchReason: payments.matchReason,
  }).from(payments).where(and(eq(payments.status, "unmatched"), isNotNull(payments.shortcodeId))).orderBy(asc(payments.paidAt)).limit(150);

  const groups = new Map<string, typeof pending>();
  for (const p of pending) groups.set(p.shortcodeId!, [...(groups.get(p.shortcodeId!) ?? []), p]);

  let n = 0;
  for (const [scId, list] of groups) {
    const sc = byId.get(scId);
    if (!sc || budget.left <= 0) continue;

    if (sc.type === "paybill") {
      const withRef = list.filter((p) => p.billRef);
      if (!withRef.length) continue;
      const map = await loadPaybillTenants(scId);
      for (const p of withRef) {
        if (budget.left <= 0) break;
        const key = normaliseRef(p.billRef!);
        const t = map.get(key);
        if (!t) continue;
        const next = await applyLoaded(p, t, { method: "account" });
        if (next) { map.set(key, next); n++; budget.left--; }
      }
    } else {
      const fresh = list.filter((p) => !p.autoTried);
      if (!fresh.length || sc.matchMode === "off") continue;
      const ctx = await loadTillContext(scId, sc.matchMode);
      const tried: string[] = [];
      for (const p of fresh) {
        if (budget.left <= 0) break;
        tried.push(p.id);
        const d = decide(ctx, { amount: p.amount, payerName: p.payerName, msisdn: p.msisdn, excludeTenantIds: p.matchReason?.startsWith("undone:") ? p.matchReason.slice(7).split(",") : [] });
        const t = d.auto ? ctx.tenants.find((x) => x.id === d.auto!.tenantId) : undefined;
        if (!d.auto || !t) continue;
        const next = await applyLoaded(p, t, { method: d.auto.method, reason: d.auto.reason });
        if (next) { Object.assign(t, next); n++; budget.left--; }
      }
      if (tried.length) await db.update(payments).set({ autoTried: true }).where(inArray(payments.id, tried));
    }
  }
  return n;
}
