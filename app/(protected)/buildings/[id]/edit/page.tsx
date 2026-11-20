import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { buildings } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listShortcodes } from "@/lib/mpesa/shortcodes";
import { PageHeader } from "@/components/layout/page-header";
import { BuildingForm } from "@/components/buildings/building-form";

export default async function EditBuildingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [b] = await getDb().select().from(buildings).where(eq(buildings.id, id)).limit(1);
  if (!b) notFound();
  // The building's own shortcode is always listed (even if inactive) so it can be shown as locked.
  const all = await listShortcodes();
  const options = all.filter((s) => s.active || s.id === b.shortcodeId).map((s) => ({ id: s.id, label: s.label, type: s.type, number: s.number }));
  return (
    <>
      <PageHeader title={`Edit ${b.name}`} description="Update this building’s details." />
      <div className="mt-6 max-w-2xl"><BuildingForm shortcodes={options} building={{ id: b.id, name: b.name, totalUnits: b.totalUnits, address: b.address, shortcodeId: b.shortcodeId }} /></div>
    </>
  );
}
