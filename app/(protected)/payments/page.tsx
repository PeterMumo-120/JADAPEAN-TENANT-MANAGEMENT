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
import { TillInbox } from "@/components/payments/till-inbox";
import { TillTotalsGrid } from "@/components/payments/till-totals";
import { getTillInbox, getTillTotals } from "@/lib/payments/till-queries";
import { UnmatchedList } from "@/components/payments/unmatched-list";

export default async function PaymentsPage() {
  await requireAdmin();
  const period = currentPeriod();
  const [collected, received, unmatchedCount, recent, unmatchedAll, tenantOptions, lastSync, tillGroups, tillTotals] = await Promise.all([
    collectedFor(period), countPaymentsSince(new Date(`${period}-01T00:00:00+03:00`)), countUnmatched(),
    getRecentPayments(25), getUnmatched(), getTenantOptions(), getLastSync(), getTillInbox(), getTillTotals(),
  ]);
  // Till payments are handled in the till inbox below; everything else that is unmatched stays in "Needs assigning".
  const unmatched = unmatchedAll.filter((p) => p.shortcodeType !== "till");
  const tillWaiting = tillGroups.reduce((a, g) => a + g.items.length, 0);
  const stats = [
    { label: "Collected this month", value: money(collected), icon: ArrowDownLeft },
    { label: "Payments received", value: String(received), icon: Check },
    { label: "Waiting to be matched", value: String(unmatchedCount), icon: Clock3 },
    { label: "Last checked", value: lastSync ? formatWhen(lastSync) : "Not yet", icon: ShieldCheck },
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

      <div id="needs-matching" className="scroll-mt-24" />
      {tillTotals.length > 0 && (
        <Card className="panel-card mt-5">
          <div className="border-b px-5 py-4">
            <h2 className="font-display text-[18px]">Till money this month</h2>
            <p className="mt-1 text-xs text-muted-foreground">Compare “Received” with your till’s M-Pesa statement. “Not matched yet” is money that has arrived but isn’t linked to a tenant.</p>
          </div>
          <TillTotalsGrid totals={tillTotals} />
        </Card>
      )}

      {tillWaiting > 0 && (
        <Card className="panel-card mt-5" id="till-inbox">
          <div className="border-b px-5 py-4">
            <h2 className="font-display text-[18px]">Payments waiting to be matched to a tenant <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">{tillWaiting}</span></h2>
            <p className="mt-1 text-xs text-muted-foreground">Till payments don’t say who they are from, so the app makes its best guess and selects it for you. Check it and press Assign. When the app is very sure, it matches the payment by itself and tells you in the list below.</p>
          </div>
          <TillInbox groups={tillGroups} />
        </Card>
      )}

      {unmatched.length > 0 && (
        <Card className="panel-card mt-5">
          <div className="border-b px-5 py-4">
            <h2 className="font-display text-[18px]">Money received, whose is it? <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">{unmatched.length}</span></h2>
            <p className="mt-1 text-xs text-muted-foreground">These payments arrived with an account number that matches nobody. Choose the tenant each one belongs to, or press Ignore if it isn’t rent.</p>
          </div>
          <UnmatchedList items={unmatched} tenants={tenantOptions} />
        </Card>
      )}

      <Card className="panel-card mt-5">
        <div className="border-b px-5 py-4">
          <h2 className="font-display text-[18px]">Recent M-Pesa payments</h2>
          <p className="mt-1 text-xs text-muted-foreground">Payments to your paybills and tills. Paybills match by account number; tills are matched from the payer’s details, or by you.</p>
        </div>
        {recent.length ? <PaymentRows items={recent} /> : (
          <EmptyState icon={Wallet} title="No payments yet" description="Payments to your paybills and tills will appear here as they arrive, or press Refresh to check now." />
        )}
        <div className="border-t px-5 py-3 text-xs text-muted-foreground">
          Showing {recent.length} payment{recent.length === 1 ? "" : "s"} · All amounts in KES · {lastSync ? `Last synced ${formatWhen(lastSync)}` : "Not synced yet"}
        </div>
      </Card>
    </>
  );
}
