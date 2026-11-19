import { requireAdmin } from "@/lib/auth/require-admin";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/layout/refresh-button";
import { PrimaryLink } from "@/components/layout/primary-link";
import { Overview } from "@/components/dashboard/overview";
import { AutoSync } from "@/components/dashboard/auto-sync";

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }).format(new Date())) % 24;
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const me = await requireAdmin();
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${me.firstName}`}
        description="Here’s how your buildings are doing this month."
        actions={<><RefreshButton /><PrimaryLink href="/tenants/new">Add tenant</PrimaryLink></>}
      />
      <AutoSync />
      <Overview />
    </>
  );
}
