import { desc, eq } from "drizzle-orm";
import { buildings, tenants } from "@/db/schema";
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
  const data = await db.select({ t: tenants, building: buildings.name, area: buildings.address })
    .from(tenants).innerJoin(buildings, eq(tenants.buildingId, buildings.id)).orderBy(desc(tenants.createdAt));
  const buildingCount = (await db.select({ id: buildings.id }).from(buildings)).length;

  const rows: TenantRow[] = data.map(({ t, building, area }) => {
    const parts = t.name.trim().split(/\s+/);
    const s = rentSummary(t);
    return {
      id: t.id, name: t.name, initials: ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase(),
      phone: formatPhone(t.phone), building, area, houseNo: t.houseNo, accountRef: t.accountRef, rent: t.rentAmount,
      balance: t.status === "active" ? s.balance : 0, status: t.status === "active" ? s.status : "Moved out",
    };
  });

  return (
    <>
      <PageHeader title="Tenants" description="Your residents across every building, all in one place."
        actions={rows.length ? <PrimaryLink href="/tenants/new">Add tenant</PrimaryLink> : undefined} />
      <TenantsTable rows={rows} hasBuildings={buildingCount > 0} />
    </>
  );
}
