import { requireAdmin } from "@/lib/auth/require-admin";
import { PageHeader } from "@/components/layout/page-header";
import { BuildingForm } from "@/components/buildings/building-form";

export default async function NewBuildingPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Add a building" description="Name it and set how many houses it has. You can add tenants next." />
      <div className="mt-6 max-w-2xl"><BuildingForm /></div>
    </>
  );
}
