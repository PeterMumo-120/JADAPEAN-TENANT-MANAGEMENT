import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { buildings } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { PageHeader } from "@/components/layout/page-header";
import { BuildingForm } from "@/components/buildings/building-form";

export default async function EditBuildingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [b] = await getDb().select().from(buildings).where(eq(buildings.id, id)).limit(1);
  if (!b) notFound();
  return (
    <>
      <PageHeader title={b.name} description="Update this building’s details." />
      <div className="mt-6 max-w-2xl"><BuildingForm building={{ id: b.id, name: b.name, totalUnits: b.totalUnits, address: b.address }} /></div>
    </>
  );
}
