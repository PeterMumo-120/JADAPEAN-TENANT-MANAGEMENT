import { Landmark } from "lucide-react";
import { count } from "drizzle-orm";
import { buildings, payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { formatWhen } from "@/lib/format";
import { hasKeys, listShortcodes } from "@/lib/mpesa/shortcodes";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PrimaryLink } from "@/components/layout/primary-link";
import { ShortcodeList, type ShortcodeCardData } from "@/components/shortcodes/shortcode-list";

export default async function ShortcodesPage() {
  await requireAdmin();
  const db = getDb();
  const [list, bCounts, allPayments] = await Promise.all([
    listShortcodes(),
    db.select({ id: buildings.shortcodeId, n: count() }).from(buildings).groupBy(buildings.shortcodeId),
    db.select({ id: payments.shortcodeId, n: count() }).from(payments).groupBy(payments.shortcodeId),
  ]);

  const items: ShortcodeCardData[] = list.map((s) => ({
    id: s.id, label: s.label, type: s.type, number: s.number, env: s.env, active: s.active,
    hasKeys: hasKeys(s), keyPreview: s.consumerKey ? `${s.consumerKey.slice(0, 4)}…${s.consumerKey.slice(-3)}` : null, nominatedNumber: s.nominatedNumber, matchMode: s.matchMode,
    urlsRegistered: s.urlsRegisteredAt ? formatWhen(s.urlsRegisteredAt) : null,
    pullRegistered: s.pullRegisteredAt ? formatWhen(s.pullRegisteredAt) : null,
    lastSync: s.lastSyncAt ? formatWhen(s.lastSyncAt) : null, lastSyncError: s.lastSyncError,
    buildingCount: bCounts.find((b) => b.id === s.id)?.n ?? 0, paymentCount: allPayments.find((p) => p.id === s.id)?.n ?? 0,
  }));

  return (
    <>
      <PageHeader title="Payment numbers" description="Advanced set-up: the M-Pesa numbers tenants pay rent to, and how each one connects to M-Pesa. You only need this when adding a new number."
        actions={items.length ? <PrimaryLink href="/shortcodes/new">Add payment number</PrimaryLink> : undefined} />
      <div className="mt-6">
        {items.length === 0 ? (
          <Card className="panel-card">
            <EmptyState icon={Landmark} title="No payment numbers yet" description="Add the paybill or till tenants pay rent to. Each building is linked to one when you create it."
              action={<PrimaryLink href="/shortcodes/new">Add payment number</PrimaryLink>} />
          </Card>
        ) : <ShortcodeList items={items} />}
      </div>
    </>
  );
}
