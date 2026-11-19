import { ArrowDownLeft, Check, Clock3, ShieldCheck, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { formatWhen, money } from "@/lib/format";
import { getLastSync } from "@/lib/mpesa/sync";
import { collectedFor, countPaymentsSince, countUnmatched, getRecentPayments, getTenantOptions, getUnmatched } from "@/lib/payments/queries";
import { currentPeriod } from "@/lib/tenants/status";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/layout/refresh-button";
import { PaymentRows } from "@/components/payments/payment-rows";
import { UnmatchedList } from "@/components/payments/unmatched-list";

export default async function PaymentsPage() {
  await requireAdmin();
  const period = currentPeriod();
  const [collected, received, unmatchedCount, recent, unmatched, tenantOptions, lastSync] = await Promise.all([
    collectedFor(period), countPaymentsSince(new Date(`${period}-01T00:00:00+03:00`)), countUnmatched(),
    getRecentPayments(25), getUnmatched(), getTenantOptions(), getLastSync(),
  ]);
  const stats = [
    { label: "Collected this month", value: money(collected), icon: ArrowDownLeft },
    { label: "Payments received", value: String(received), icon: Check },
    { label: "Pending reconciliation", value: String(unmatchedCount), icon: Clock3 },
    { label: "M-Pesa paybill", value: process.env.MPESA_SHORTCODE || "Not set", icon: ShieldCheck },
  ];
  return (
    <>
      <PageHeader title="Payments" description="M-Pesa rent receipts and collection activity." actions={<RefreshButton />} />
      <div className="metric-grid mt-6">
        {stats.map((s) => (
          <Card className="metric-card" key={s.label}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between"><span className="eyebrow">{s.label}</span><span className="metric-icon"><s.icon className="size-4" /></span></div>
              <div className="mt-4 font-display text-[25px] font-medium tracking-tight">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {unmatched.length > 0 && (
        <Card className="panel-card mt-5">
          <div className="border-b px-5 py-4">
            <h2 className="font-display text-[18px]">Needs assigning <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">{unmatched.length}</span></h2>
            <p className="mt-1 text-xs text-muted-foreground">The account number on these payments doesn’t match any tenant. Assign each one, or ignore it if it isn’t rent.</p>
          </div>
          <UnmatchedList items={unmatched} tenants={tenantOptions} />
        </Card>
      )}

      <Card className="panel-card mt-5">
        <div className="border-b px-5 py-4">
          <h2 className="font-display text-[18px]">Recent M-Pesa payments</h2>
          <p className="mt-1 text-xs text-muted-foreground">Payments to your paybill, matched to tenants by account number.</p>
        </div>
        {recent.length ? <PaymentRows items={recent} /> : (
          <EmptyState icon={Wallet} title="No payments yet" description="Payments made to your paybill will appear here as they arrive, or press Refresh to check now." />
        )}
        <div className="border-t px-5 py-3 text-xs text-muted-foreground">
          Showing {recent.length} payment{recent.length === 1 ? "" : "s"} · All amounts in KES · {lastSync ? `Last synced ${formatWhen(lastSync)}` : "Not synced yet"}
        </div>
      </Card>
    </>
  );
}
