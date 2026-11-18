import { requireAdmin } from "@/lib/auth/require-admin";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Rent rules and who can request access." />
      <div className="mt-6"><SettingsForm initial={settings} /></div>
    </>
  );
}
