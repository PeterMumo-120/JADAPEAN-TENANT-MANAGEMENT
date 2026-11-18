import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getBuildingStats } from "@/lib/buildings/queries";
import { todayEA } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { PageHeader } from "@/components/layout/page-header";
import { TenantForm } from "@/components/tenants/tenant-form";

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [t] = await getDb().select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!t) notFound();
  const buildings = await getBuildingStats();
  return (
    <>
      <PageHeader title={t.name} description="Update this tenant’s details." />
      <div className="mt-6 max-w-2xl">
        <TenantForm today={todayEA()} buildings={buildings.map((b) => ({ id: b.id, name: b.name, totalUnits: b.totalUnits, occupied: b.occupied }))}
          tenant={{ id: t.id, name: t.name, nationalId: t.nationalId, phone: formatPhone(t.phone), buildingId: t.buildingId, houseNo: t.houseNo,
            rentAmount: t.rentAmount, accountRef: t.accountRef, moveInDate: t.moveInDate, active: t.status === "active" }} />
      </div>
    </>
  );
}
