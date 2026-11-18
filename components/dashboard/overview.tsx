import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, Clock3, Home, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildings, collections, payments, rentTrend, tenants } from "@/lib/mock-data";
import { money, slugify } from "@/lib/format";
import { PaymentRows } from "@/components/payments/payment-rows";

/** Mock data for now (lib/mock-data.ts). Swap for real queries in the next step. */
export function Overview() {
  const vacant = collections.units - collections.occupied;
  const metrics = [
    { label: "Rent collected", value: money(collections.collected), note: "90.5% of monthly target", trend: "+8.2%", tone: "up", icon: Wallet },
    { label: "Outstanding", value: money(collections.outstanding), note: "Across 31 tenants", trend: "12 overdue", tone: "warn", icon: Clock3 },
    { label: "Occupancy", value: `${((collections.occupied / collections.units) * 100).toFixed(1)}%`, note: `${collections.occupied} of ${collections.units} units occupied`, trend: `${vacant} vacant`, tone: "flat", icon: Home },
    { label: "Total tenants", value: collections.tenants.toLocaleString("en-KE"), note: `Across ${buildings.length} buildings`, trend: "+24 this month", tone: "up", icon: Users },
  ];
  const attention = tenants.filter((t) => t.status !== "Paid").slice(0, 3);

  return (
    <div className="flex flex-col gap-5 pt-7">
      <div className="metric-grid">
        {metrics.map(({ label, value, note, trend, tone, icon: Icon }) => (
          <Card key={label} className="metric-card">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between"><span className="eyebrow">{label}</span><span className="metric-icon"><Icon className="size-4" /></span></div>
              <div className="mt-3 font-display text-[26px] font-medium tracking-[-.025em]">{value}</div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs text-muted-foreground">{note}</span>
                <span className={`trend-pill trend-${tone}`}>{tone === "up" && <ArrowUpRight className="size-3" />}{trend}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="content-grid">
        <Card className="panel-card">
          <CardHeader className="px-5 pb-2 pt-5">
            <CardTitle className="font-display text-[18px] font-medium tracking-tight">Rent collection</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Monthly collections · KES millions</p>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-3">
            <div className="flex items-end justify-between gap-1 border-b border-dashed border-border pb-3">
              <div className="flex items-end gap-2">
                <span className="font-display text-[26px] font-medium tracking-tight">KES 8.6M</span>
                <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><ArrowUpRight className="size-3" /> 8.2%</span>
              </div>
              <span className="mb-1 text-xs text-muted-foreground">vs last month</span>
            </div>
            <div className="chart-area">
              <div className="chart-y-axis"><span>10M</span><span>7.5M</span><span>5M</span><span>2.5M</span><span>0</span></div>
              <div className="chart-plot">
                <div className="chart-gridlines"><i /><i /><i /><i /><i /></div>
                <div className="bars">
                  {rentTrend.map((item, index) => (
                    <div className="bar-column" key={item.month}>
                      <div className={`bar ${index === rentTrend.length - 1 ? "bar-current" : ""}`} style={{ height: `${item.value * 10}%` }} title={`${item.month}: KES ${item.value}M`} />
                      <span>{item.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
            <div>
              <CardTitle className="font-display text-[18px] font-medium tracking-tight">Buildings</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Collection by building</p>
            </div>
            <Link href="/buildings" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-0 px-5">
            {buildings.map((b) => (
              <Link href={`/buildings/${slugify(b.name)}`} className="property-row" key={b.name}>
                <div className="property-symbol"><Building2 className="size-4" /></div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[12px] font-medium">{b.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{b.estate} · {b.occupied}/{b.units} houses</div>
                </div>
                <div className="min-w-[74px] text-right">
                  <div className="text-xs font-semibold">{Math.round((b.collected / b.target) * 100)}%</div>
                  <div className="progress-track mt-1.5"><div className="progress-fill" style={{ width: `${(b.collected / b.target) * 100}%` }} /></div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="bottom-grid">
        <Card className="panel-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-2 pt-5">
            <div>
              <CardTitle className="font-display text-[18px] font-medium tracking-tight">Recent payments</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Latest M-Pesa rent receipts</p>
            </div>
            <Link href="/payments" className="inline-flex items-center text-xs font-medium text-primary hover:underline">All payments <ArrowRight className="ml-1 size-3.5" /></Link>
          </CardHeader>
          <CardContent className="px-0 pb-1"><PaymentRows items={payments.slice(0, 4)} /></CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
            <div>
              <CardTitle className="font-display text-[18px] font-medium tracking-tight">Needs attention</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Rent that needs a follow-up</p>
            </div>
            <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">12 overdue</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-5 pb-4">
            {attention.map((t) => (
              <Link href={`/tenants/${t.id}`} className="attention-row" key={t.id}>
                <div className="avatar-initials size-8 bg-accent text-primary">{t.initials}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{t.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t.unit} · {t.building}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold">{money(t.balance)}</div>
                  <div className="mt-0.5 text-xs text-destructive">{t.status === "Overdue" ? t.paidOn : "Due today"}</div>
                </div>
              </Link>
            ))}
            <Link href="/tenants" className="mt-1 text-left text-xs font-medium text-primary hover:underline">
              View all outstanding rent <ArrowRight className="ml-1 inline size-3" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
