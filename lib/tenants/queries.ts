import { desc, eq, inArray } from "drizzle-orm";
import { buildings, paymentAllocations, payments, shortcodes, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { formatWhen } from "@/lib/format";

export type TenantPayment = { id: string; receipt: string; amount: number; time: string; source: "c2b" | "reconcile" | "manual"; periods: string[] };

/** One tenant with their building, paybill/till and payment history. Null when it doesn't exist. */
export async function getTenantDetail(id: string) {
  const db = getDb();
  const [row] = await db.select({ t: tenants, b: buildings, sc: shortcodes }).from(tenants)
    .innerJoin(buildings, eq(tenants.buildingId, buildings.id)).leftJoin(shortcodes, eq(buildings.shortcodeId, shortcodes.id))
    .where(eq(tenants.id, id)).limit(1);
  if (!row) return null;

  const pays = await db.select().from(payments).where(eq(payments.tenantId, id)).orderBy(desc(payments.paidAt)).limit(30);
  const allocs = pays.length ? await db.select().from(paymentAllocations).where(inArray(paymentAllocations.paymentId, pays.map((p) => p.id))) : [];
  const history: TenantPayment[] = pays.map((p) => ({
    id: p.id, receipt: p.mpesaReceipt, amount: p.amount, time: formatWhen(p.paidAt), source: p.source,
    periods: allocs.filter((a) => a.paymentId === p.id).map((a) => a.period).sort(),
  }));
  return { tenant: row.t, building: row.b, shortcode: row.sc, history, paymentCount: pays.length };
}
