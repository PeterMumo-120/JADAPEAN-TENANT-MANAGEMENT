import { requireAdmin } from "@/lib/auth/require-admin";
import { getBuildingStats } from "@/lib/buildings/queries";
import { toBuildingOptions } from "@/lib/buildings/options";
import { PageHeader } from "@/components/layout/page-header";
import { TenantForm } from "@/components/tenants/tenant-form";

export default async function NewTenantPage() {
  await requireAdmin();
  const buildings = await getBuildingStats();
  return (
    <>
      <PageHeader title="Add a tenant" description="Add a resident to one of your buildings. You can update these details later." />
      <div className="mt-6 max-w-2xl"><TenantForm buildings={toBuildingOptions(buildings)} /></div>
    </>
  );
}
