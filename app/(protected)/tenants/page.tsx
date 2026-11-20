import { desc, eq } from "drizzle-orm";
import { buildings, shortcodes, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { formatPhone } from "@/lib/phone";
import { rentSummary } from "@/lib/tenants/status";
import { PageHeader } from "@/components/layout/page-header";
import { PrimaryLink } from "@/components/layout/primary-link";
import { TenantsTable, type TenantRow } from "@/components/tenants/tenants-table";

export default async function TenantsPage() {
  await requireAdmin();
  const db = getDb();
  const [data, allBuildings] = await Promise.all([
    db.select({ t: tenants, building: buildings.name, area: buildings.address, sc: shortcodes }).from(tenants)
      .innerJoin(buildings, eq(tenants.buildingId, buildings.id)).leftJoin(shortcodes, eq(buildings.shortcodeId, shortcodes.id)).orderBy(desc(tenants.createdAt)),
    db.select({ id: buildings.id, name: buildings.name }).from(buildings).orderBy(buildings.name),
  ]);

  const rows: TenantRow[] = data.map(({ t, building, area, sc }) => {
    const parts = t.name.trim().split(/\s+/);
    const s = rentSummary(t);
    const payVia = sc?.type === "till" ? `Till ${sc.number}` : t.accountRef ? t.accountRef : sc ? `Paybill ${sc.number}` : "—";
    return {
      id: t.id, name: t.name, initials: ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase(),
      phone: formatPhone(t.phone), building, buildingId: t.buildingId, area, houseNo: t.houseNo, payVia, rent: t.rentAmount,
      balance: t.status === "active" ? s.balance : 0, status: t.status === "active" ? s.status : "Moved out",
    };
  });

  return (
    <>
      <PageHeader title="Tenants" description="Your residents across every building, all in one place."
        actions={rows.length ? <PrimaryLink href="/tenants/new">Add tenant</PrimaryLink> : undefined} />
      <TenantsTable rows={rows} hasBuildings={allBuildings.length > 0} buildingOptions={allBuildings} />
    </>
  );
}
