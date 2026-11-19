import { eq, inArray, sum } from "drizzle-orm";
import { buildings, paymentAllocations, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getBuildingStats } from "@/lib/buildings/queries";
import { getRecentPayments } from "@/lib/payments/queries";
import { prevPeriod } from "@/lib/payments/allocate";
import { currentPeriod, rentSummary } from "@/lib/tenants/status";

const monthLabel = (p: string) => { const [y, m] = p.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" }); };

export async function getDashboardData() {
  const db = getDb();
  const period = currentPeriod();
  const periods = [period];
  for (let i = 0; i < 5; i++) periods.unshift(prevPeriod(periods[0]));

  const [tenantRows, trendRows, recent, buildingStats] = await Promise.all([
    db.select({ t: tenants, building: buildings.name }).from(tenants).innerJoin(buildings, eq(tenants.buildingId, buildings.id)).where(eq(tenants.status, "active")),
    db.select({ period: paymentAllocations.period, total: sum(paymentAllocations.amount) }).from(paymentAllocations)
      .where(inArray(paymentAllocations.period, periods)).groupBy(paymentAllocations.period),
    getRecentPayments(4),
    getBuildingStats(),
  ]);

  const trend = periods.map((p) => ({ month: monthLabel(p), value: Number(trendRows.find((r) => r.period === p)?.total ?? 0) }));
  const collected = trend[trend.length - 1].value;
  const previous = trend[trend.length - 2].value;
  const rows = tenantRows.map(({ t, building }) => ({ t, building, s: rentSummary(t) }));
  const expected = rows.reduce((a, r) => a + r.t.rentAmount, 0);
  const totalUnits = buildingStats.reduce((a, b) => a + b.totalUnits, 0);
  const behind = rows.filter((r) => r.s.status !== "Paid").sort((a, b) => b.s.balance - a.s.balance);

  return {
    collected, expected,
    pctOfTarget: expected > 0 ? (collected / expected) * 100 : null,
    changePct: previous > 0 ? ((collected - previous) / previous) * 100 : null,
    outstanding: rows.reduce((a, r) => a + r.s.balance, 0),
    outstandingTenants: rows.filter((r) => r.s.balance > 0).length,
    overdue: rows.filter((r) => r.s.status === "Overdue").length,
    occupied: rows.length, totalUnits, vacant: Math.max(totalUnits - rows.length, 0),
    newThisMonth: rows.filter((r) => r.t.moveInDate.startsWith(period)).length,
    trend, buildings: buildingStats, recent,
    attention: behind.slice(0, 3).map(({ t, building, s }) => {
      const parts = t.name.trim().split(/\s+/);
      return { id: t.id, name: t.name, initials: ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase(), unit: t.houseNo ?? "No house number",
        building, balance: s.balance, overdue: s.status === "Overdue", note: s.status === "Overdue" ? `${s.monthsOwed} months behind` : "Due this month" };
    }),
  };
}
