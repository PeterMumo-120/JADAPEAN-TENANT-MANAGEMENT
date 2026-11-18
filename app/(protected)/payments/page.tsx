import { ArrowDownLeft, Check, Clock3, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { payments } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/layout/refresh-button";
import { PaymentRows } from "@/components/payments/payment-rows";

export default async function PaymentsPage() {
  await requireAdmin();
  const paybill = process.env.MPESA_SHORTCODE || "Not set";
  const stats = [
    { label: "Collected this month", value: "KES 8.6M", icon: ArrowDownLeft },
    { label: "Payments received", value: "347", icon: Check },
    { label: "Pending reconciliation", value: "12", icon: Clock3 },
    { label: "M-Pesa paybill", value: paybill, icon: ShieldCheck },
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
      <Card className="panel-card mt-5">
        <div className="border-b px-5 py-4">
          <h2 className="font-display text-[18px]">Recent M-Pesa payments</h2>
          <p className="mt-1 text-xs text-muted-foreground">Matched to tenant accounts from your paybill.</p>
        </div>
        {payments.length ? <PaymentRows items={payments} /> : <p className="p-10 text-center text-sm text-muted-foreground">No payments yet. Payments made to your paybill will appear here.</p>}
        <div className="border-t px-5 py-3 text-xs text-muted-foreground">Showing {payments.length} matched transactions · All amounts in KES</div>
      </Card>
    </>
  );
}
