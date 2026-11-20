import { requireAdmin } from "@/lib/auth/require-admin";
import { listShortcodes } from "@/lib/mpesa/shortcodes";
import { PageHeader } from "@/components/layout/page-header";
import { BuildingForm } from "@/components/buildings/building-form";

export default async function NewBuildingPage() {
  await requireAdmin();
  const shortcodes = await listShortcodes({ activeOnly: true });
  return (
    <>
      <PageHeader title="Add a building" description="Name it, set how many houses it has and choose the paybill or till it collects rent on." />
      <div className="mt-6 max-w-2xl"><BuildingForm shortcodes={shortcodes.map((s) => ({ id: s.id, label: s.label, type: s.type, number: s.number }))} /></div>
    </>
  );
}
