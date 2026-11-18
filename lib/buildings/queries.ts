import { count, eq, sum } from "drizzle-orm";
import { buildings, paymentAllocations, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { currentPeriod } from "@/lib/tenants/status";

export type BuildingStat = {
  id: string; name: string; totalUnits: number; address: string | null;
  occupied: number; target: number; collected: number;
};

/** Every building with live occupancy (active tenants), monthly target (their rent) and this month's collected rent. */
export async function getBuildingStats(): Promise<BuildingStat[]> {
  const db = getDb();
  const [all, occ, coll] = await Promise.all([
    db.select().from(buildings).orderBy(buildings.name),
    db.select({ buildingId: tenants.buildingId, occupied: count(), target: sum(tenants.rentAmount) })
      .from(tenants).where(eq(tenants.status, "active")).groupBy(tenants.buildingId),
    db.select({ buildingId: tenants.buildingId, collected: sum(paymentAllocations.amount) })
      .from(paymentAllocations).innerJoin(tenants, eq(paymentAllocations.tenantId, tenants.id))
      .where(eq(paymentAllocations.period, currentPeriod())).groupBy(tenants.buildingId),
  ]);
  return all.map((b) => {
    const o = occ.find((x) => x.buildingId === b.id);
    const c = coll.find((x) => x.buildingId === b.id);
    return { id: b.id, name: b.name, totalUnits: b.totalUnits, address: b.address,
      occupied: o?.occupied ?? 0, target: Number(o?.target ?? 0), collected: Number(c?.collected ?? 0) };
  });
}
