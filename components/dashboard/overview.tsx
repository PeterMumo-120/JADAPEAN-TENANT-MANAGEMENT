import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, Check, Clock3, Home, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PrimaryLink } from "@/components/layout/primary-link";
import { PaymentRows } from "@/components/payments/payment-rows";
import { getDashboardData } from "@/lib/dashboard/queries";
import { compactNumber, money } from "@/lib/format";

/** Rounds the top of the chart axis up to 1, 2, 4, 8 or 10 times a power of ten. */
function niceMax(v: number) {
  if (v <= 0) return 100_000;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 4, 8, 10].find((k) => k * p >= v) ?? 10) * p;
}

export async function Overview() {
  const d = await getDashboardData();
  const s = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  const metrics = [
    { label: "Rent collected", value: money(d.collected), icon: Wallet,
      note: d.pctOfTarget === null ? "No rent expected yet" : `${d.pctOfTarget.toFixed(1)}% of monthly target`,
      trend: d.changePct === null ? "First month" : `${d.changePct >= 0 ? "+" : ""}${d.changePct.toFixed(1)}%`, tone: d.changePct === null ? "flat" : d.changePct >= 0 ? "up" : "warn" },
    { label: "Outstanding", value: money(d.outstanding), icon: Clock3, note: `Across ${s(d.outstandingTenants, "tenant")}`,
      trend: `${d.overdue} overdue`, tone: d.overdue > 0 ? "warn" : "flat" },
    { label: "Occupancy", value: d.totalUnits ? `${((d.occupied / d.totalUnits) * 100).toFixed(1)}%` : "—", icon: Home,
      note: `${d.occupied} of ${s(d.totalUnits, "house")} occupied`, trend: `${d.vacant} vacant`, tone: "flat" },
    { label: "Total tenants", value: d.occupied.toLocaleString("en-KE"), icon: Users, note: `Across ${s(d.buildings.length, "building")}`,
      trend: `${d.newThisMonth} new this month`, tone: d.newThisMonth > 0 ? "up" : "flat" },
  ];
  const axisMax = niceMax(Math.max(...d.trend.map((t) => t.value)));

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
            <p className="mt-1 text-xs text-muted-foreground">Rent collected per month · KES</p>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-3">
            <div className="flex items-end justify-between gap-1 border-b border-dashed border-border pb-3">
              <div className="flex items-end gap-2">
                <span className="font-display text-[26px] font-medium tracking-tight">KES {compactNumber(d.collected)}</span>
                {d.changePct !== null && <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><ArrowUpRight className="size-3" /> {d.changePct.toFixed(1)}%</span>}
              </div>
              <span className="mb-1 text-xs text-muted-foreground">this month</span>
            </div>
            <div className="chart-area">
              <div className="chart-y-axis">{[1, 0.75, 0.5, 0.25, 0].map((f) => <span key={f}>{f === 0 ? "0" : compactNumber(axisMax * f)}</span>)}</div>
              <div className="chart-plot">
                <div className="chart-gridlines"><i /><i /><i /><i /><i /></div>
                <div className="bars">
                  {d.trend.map((item, index) => (
                    <div className="bar-column" key={`${item.month}-${index}`}>
                      <div className={`bar ${index === d.trend.length - 1 ? "bar-current" : ""}`} style={{ height: `${(item.value / axisMax) * 100}%` }} title={`${item.month}: ${money(item.value)}`} />
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
            {d.buildings.length === 0 ? (
              <EmptyState icon={Building2} title="No buildings yet" description="Add a building to start tracking rent." action={<PrimaryLink href="/buildings/new">Add building</PrimaryLink>} />
            ) : d.buildings.map((b) => {
              const pct = b.target > 0 ? Math.round((b.collected / b.target) * 100) : 0;
              return (
                <Link href={`/buildings/${b.id}`} className="property-row" key={b.id}>
                  <div className="property-symbol"><Building2 className="size-4" /></div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[13px] font-medium">{b.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{b.address ?? "No area set"} · {b.occupied}/{b.totalUnits} houses</div>
                  </div>
                  <div className="min-w-[74px] text-right">
                    <div className="text-xs font-semibold">{pct}%</div>
                    <div className="progress-track mt-1.5"><div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                  </div>
                </Link>
              );
            })}
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
          <CardContent className="px-0 pb-1">
            {d.recent.length ? <PaymentRows items={d.recent} /> : <EmptyState icon={Wallet} title="No payments yet" description="Payments to your paybills and tills appear here as they come in." />}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
            <div>
              <CardTitle className="font-display text-[18px] font-medium tracking-tight">Needs attention</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Rent that needs a follow-up</p>
            </div>
            {d.overdue > 0 && <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">{d.overdue} overdue</span>}
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-5 pb-4">
            {d.attention.length === 0 ? (
              <EmptyState icon={Check} title="Everyone is paid up" description="Tenants with rent due will show up here." />
            ) : d.attention.map((t) => (
              <Link href={`/tenants/${t.id}`} className="attention-row" key={t.id}>
                <div className="avatar-initials size-8 bg-accent text-primary">{t.initials}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{t.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t.unit} · {t.building}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold">{money(t.balance)}</div>
                  <div className={`mt-0.5 text-xs ${t.overdue ? "text-destructive" : "text-muted-foreground"}`}>{t.note}</div>
                </div>
              </Link>
            ))}
            {d.attention.length > 0 && (
              <Link href="/tenants" className="mt-1 text-left text-xs font-medium text-primary hover:underline">
                View all outstanding rent <ArrowRight className="ml-1 inline size-3" />
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
