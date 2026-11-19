import { asc, and, eq, isNotNull } from "drizzle-orm";
import { paymentAllocations, payments, tenants } from "@/db/schema";
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

/** The active tenant whose account number equals what the payer typed (ignoring case, spaces and dashes). */
export async function matchTenant(billRef: string | null): Promise<string | null> {
  const ref = billRef ? normaliseRef(billRef) : "";
  if (ref.length < 2) return null;
  const rows = await getDb().select({ id: tenants.id, ref: tenants.accountRef }).from(tenants).where(eq(tenants.status, "active"));
  return rows.find((r) => normaliseRef(r.ref) === ref)?.id ?? null;
}

export async function matchPayment(paymentId: string, billRef: string | null): Promise<boolean> {
  const tenantId = await matchTenant(billRef);
  return tenantId ? (await applyPayment(paymentId, tenantId)) === "matched" : false;
}

/** Retries every unmatched payment, oldest first. Picks up payments whose tenant was added after they arrived. */
export async function rematchUnmatched(): Promise<number> {
  const rows = await getDb().select({ id: payments.id, billRef: payments.billRef }).from(payments)
    .where(and(eq(payments.status, "unmatched"), isNotNull(payments.billRef))).orderBy(asc(payments.paidAt));
  let n = 0;
  for (const r of rows) if (await matchPayment(r.id, r.billRef)) n++;
  return n;
}
