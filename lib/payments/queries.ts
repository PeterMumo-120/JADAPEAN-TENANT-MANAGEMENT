import { count, desc, eq, gte, ne, sum } from "drizzle-orm";
import { buildings, paymentAllocations, payments, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { formatWhen } from "@/lib/format";

export type PaymentItem = { id: string; name: string; unit: string; building: string; receipt: string; amount: number; time: string; matched: boolean };

/** Latest payments (matched and unmatched, not ignored), newest first. */
export async function getRecentPayments(limit: number): Promise<PaymentItem[]> {
  const rows = await getDb().select({ p: payments, tenant: tenants.name, house: tenants.houseNo, building: buildings.name })
    .from(payments).leftJoin(tenants, eq(payments.tenantId, tenants.id)).leftJoin(buildings, eq(tenants.buildingId, buildings.id))
    .where(ne(payments.status, "ignored")).orderBy(desc(payments.paidAt)).limit(limit);
  return rows.map(({ p, tenant, house, building }) => ({
    id: p.id, name: tenant ?? p.payerName ?? "Unmatched payment",
    unit: tenant ? house ?? "No house number" : `Account: ${p.billRef ?? "none"}`,
    building: building ?? "Needs assigning", receipt: p.mpesaReceipt, amount: p.amount, time: formatWhen(p.paidAt), matched: !!tenant,
  }));
}

export type UnmatchedItem = { id: string; payer: string; billRef: string | null; receipt: string; amount: number; time: string };
export async function getUnmatched(limit = 50): Promise<UnmatchedItem[]> {
  const rows = await getDb().select().from(payments).where(eq(payments.status, "unmatched")).orderBy(desc(payments.paidAt)).limit(limit);
  return rows.map((p) => ({ id: p.id, payer: p.payerName ?? "an unknown payer", billRef: p.billRef, receipt: p.mpesaReceipt, amount: p.amount, time: formatWhen(p.paidAt) }));
}

export type TenantOption = { id: string; label: string };
export async function getTenantOptions(): Promise<TenantOption[]> {
  const rows = await getDb().select({ id: tenants.id, name: tenants.name, house: tenants.houseNo, ref: tenants.accountRef, building: buildings.name })
    .from(tenants).innerJoin(buildings, eq(tenants.buildingId, buildings.id)).where(eq(tenants.status, "active")).orderBy(buildings.name, tenants.name);
  return rows.map((r) => ({ id: r.id, label: `${r.name} · ${r.building}${r.house ? ` ${r.house}` : ""} (${r.ref})` }));
}

export async function collectedFor(period: string): Promise<number> {
  const [r] = await getDb().select({ total: sum(paymentAllocations.amount) }).from(paymentAllocations).where(eq(paymentAllocations.period, period));
  return Number(r?.total ?? 0);
}
export async function countPaymentsSince(date: Date): Promise<number> {
  const [r] = await getDb().select({ n: count() }).from(payments).where(gte(payments.paidAt, date));
  return r?.n ?? 0;
}
export async function countUnmatched(): Promise<number> {
  const [r] = await getDb().select({ n: count() }).from(payments).where(eq(payments.status, "unmatched"));
  return r?.n ?? 0;
}
