import { and, count, eq, isNotNull, isNull, sum } from "drizzle-orm";
import { buildings, paymentAllocations, shortcodes, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { currentPeriod } from "@/lib/tenants/status";

export type ShortcodeBrief = { id: string; label: string; type: "paybill" | "till"; number: string; active: boolean } | null;

export type BuildingStat = {
  id: string; name: string; totalUnits: number; address: string | null;
  occupied: number; target: number; collected: number;
  archived: boolean; shortcode: ShortcodeBrief;
};

/** Every building with live occupancy (active tenants), monthly target (their rent) and this month's collected rent. */
export async function getBuildingStats(opts: { includeArchived?: boolean } = {}): Promise<BuildingStat[]> {
  const db = getDb();
  const base = db.select({ b: buildings, sc: shortcodes }).from(buildings).leftJoin(shortcodes, eq(buildings.shortcodeId, shortcodes.id));
  const [all, occ, coll] = await Promise.all([
    (opts.includeArchived ? base : base.where(isNull(buildings.archivedAt))).orderBy(buildings.name),
    db.select({ buildingId: tenants.buildingId, occupied: count(), target: sum(tenants.rentAmount) })
      .from(tenants).where(eq(tenants.status, "active")).groupBy(tenants.buildingId),
    db.select({ buildingId: tenants.buildingId, collected: sum(paymentAllocations.amount) })
      .from(paymentAllocations).innerJoin(tenants, eq(paymentAllocations.tenantId, tenants.id))
      .where(eq(paymentAllocations.period, currentPeriod())).groupBy(tenants.buildingId),
  ]);
  return all.map(({ b, sc }) => {
    const o = occ.find((x) => x.buildingId === b.id);
    const c = coll.find((x) => x.buildingId === b.id);
    return {
      id: b.id, name: b.name, totalUnits: b.totalUnits, address: b.address,
      occupied: o?.occupied ?? 0, target: Number(o?.target ?? 0), collected: Number(c?.collected ?? 0),
      archived: !!b.archivedAt,
      shortcode: sc ? { id: sc.id, label: sc.label, type: sc.type, number: sc.number, active: sc.active } : null,
    };
  });
}

export async function countArchivedBuildings(): Promise<number> {
  const [r] = await getDb().select({ n: count() }).from(buildings).where(isNotNull(buildings.archivedAt));
  return r?.n ?? 0;
}

export type BuildingTenant = {
  id: string; name: string; houseNo: string | null; phone: string; rent: number; accountRef: string | null;
  status: "active" | "moved_out"; moveInDate: string; paidThrough: string | null; creditBalance: number;
};

/** One building with its tenants (active first). Null when it doesn't exist. */
export async function getBuildingDetail(id: string) {
  const db = getDb();
  const [row] = await db.select({ b: buildings, sc: shortcodes }).from(buildings).leftJoin(shortcodes, eq(buildings.shortcodeId, shortcodes.id)).where(eq(buildings.id, id)).limit(1);
  if (!row) return null;
  const list = await db.select().from(tenants).where(eq(tenants.buildingId, id)).orderBy(tenants.houseNo, tenants.name);
  const [{ collected }] = await db.select({ collected: sum(paymentAllocations.amount) }).from(paymentAllocations)
    .innerJoin(tenants, eq(paymentAllocations.tenantId, tenants.id))
    .where(and(eq(tenants.buildingId, id), eq(paymentAllocations.period, currentPeriod())));
  return { building: row.b, shortcode: row.sc, tenants: list, collected: Number(collected ?? 0) };
}
