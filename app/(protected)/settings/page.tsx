import Link from "next/link";
import { ChevronRight, Landmark } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Rent rules and who can request access." />
      <div className="mt-6 flex max-w-2xl flex-col gap-5">
        <Link href="/shortcodes" className="block">
          <Card className="panel-card transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="metric-icon"><Landmark className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[13px] font-medium">Paybills & Tills</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Add the M-Pesa numbers you collect rent on and connect each one’s Daraja app.</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </Card>
        </Link>
        <SettingsForm initial={settings} />
      </div>
    </>
  );
}
