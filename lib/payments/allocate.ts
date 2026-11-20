import { asc, and, eq, isNotNull, isNull } from "drizzle-orm";
import { buildings, paymentAllocations, payments, shortcodes, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { normaliseRef } from "@/lib/format";

export function nextPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
export function prevPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Applies a payment to a tenant: pays the oldest unpaid month first, then later months.
 * `paidThrough` is the last fully paid month; `creditBalance` is what has already been paid toward the month after it.
 */
export async function applyPayment(paymentId: string, tenantId: string): Promise<"matched" | "already" | "missing"> {
  const db = getDb();
  const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!pay || !t) return "missing";
  if (pay.status === "matched") return "already";

  let paid = t.paidThrough ?? prevPeriod(t.moveInDate.slice(0, 7));
  let credit = t.creditBalance;
  let remaining = pay.amount;
  const allocs: { paymentId: string; tenantId: string; period: string; amount: number }[] = [];
  while (remaining > 0 && allocs.length < 24) {
    const period = nextPeriod(paid);
    const need = t.rentAmount - credit;
    if (need <= 0) { paid = period; credit = 0; continue; }
    const take = Math.min(remaining, need);
    allocs.push({ paymentId, tenantId, period, amount: take });
    remaining -= take;
    if (take === need) { paid = period; credit = 0; } else { credit += take; }
  }
  if (!allocs.length) return "missing";

  await db.batch([
    db.insert(paymentAllocations).values(allocs),
    db.update(tenants).set({ paidThrough: paid, creditBalance: credit, updatedAt: new Date() }).where(eq(tenants.id, tenantId)),
    db.update(payments).set({ tenantId, status: "matched" }).where(eq(payments.id, paymentId)),
  ]);
  return "matched";
}

/**
 * The active tenant, in a building under this PAYBILL, whose account number equals what the payer typed
 * (ignoring case, spaces and dashes). Tills never auto-match: they have no account number.
 */
export async function matchTenant(shortcodeId: string | null, billRef: string | null): Promise<string | null> {
  const ref = billRef ? normaliseRef(billRef) : "";
  if (!shortcodeId || ref.length < 2) return null;
  const db = getDb();
  const [sc] = await db.select({ type: shortcodes.type }).from(shortcodes).where(eq(shortcodes.id, shortcodeId)).limit(1);
  if (!sc || sc.type !== "paybill") return null;
  const rows = await db.select({ id: tenants.id, ref: tenants.accountRef }).from(tenants)
    .innerJoin(buildings, eq(tenants.buildingId, buildings.id))
    .where(and(eq(tenants.status, "active"), eq(buildings.shortcodeId, shortcodeId)));
  return rows.find((r) => r.ref && normaliseRef(r.ref) === ref)?.id ?? null;
}

export async function matchPayment(paymentId: string, shortcodeId: string | null, billRef: string | null): Promise<boolean> {
  const tenantId = await matchTenant(shortcodeId, billRef);
  return tenantId ? (await applyPayment(paymentId, tenantId)) === "matched" : false;
}

/**
 * Retries unmatched payments, oldest first. First links payments whose shortcode was added after they arrived,
 * then re-tries paybill payments (a tenant may have been added since). Tills are skipped on purpose.
 */
export async function rematchUnmatched(): Promise<number> {
  const db = getDb();
  const all = await db.select().from(shortcodes);
  const byNumber = new Map(all.map((s) => [s.number, s]));

  const orphans = await db.select({ id: payments.id, number: payments.shortcodeNumber }).from(payments)
    .where(and(eq(payments.status, "unmatched"), isNull(payments.shortcodeId), isNotNull(payments.shortcodeNumber)));
  for (const o of orphans) {
    const sc = o.number ? byNumber.get(o.number) : undefined;
    if (sc) await db.update(payments).set({ shortcodeId: sc.id }).where(eq(payments.id, o.id));
  }

  const rows = await db.select({ id: payments.id, billRef: payments.billRef, shortcodeId: payments.shortcodeId }).from(payments)
    .where(and(eq(payments.status, "unmatched"), isNotNull(payments.billRef), isNotNull(payments.shortcodeId))).orderBy(asc(payments.paidAt));
  let n = 0;
  for (const r of rows) if (await matchPayment(r.id, r.shortcodeId, r.billRef)) n++;
  return n;
}
