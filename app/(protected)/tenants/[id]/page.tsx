import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { dateEA, money, todayEA } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { getTenantDetail } from "@/lib/tenants/queries";
import { rentSummary } from "@/lib/tenants/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { ShortcodeBadge } from "@/components/shortcodes/shortcode-badge";
import { StatusBadge } from "@/components/tenants/status-badge";
import { TenantActions } from "@/components/tenants/tenant-actions";
import { KnownPayers } from "@/components/tenants/known-payers";
import { MatchBadge } from "@/components/payments/match-badge";

const monthName = (p: string) => { const [y, m] = p.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }); };
const SOURCE = { c2b: "M-Pesa", reconcile: "M-Pesa (synced)", manual: "Marked manually" } as const;

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const d = await getTenantDetail(id);
  if (!d) notFound();
  const { tenant: t, building: b, shortcode: sc } = d;
  const active = t.status === "active";
  const s = rentSummary(t);
  const status = active ? s.status : "Moved out";

  const facts: [string, React.ReactNode][] = [
    ["Phone", formatPhone(t.phone)],
    ["ID / passport", t.nationalId],
    ["Building", <Link key="b" href={`/buildings/${b.id}`} className="text-primary hover:underline">{b.name}</Link>],
    ["House", t.houseNo ?? "Not set"],
    ["Moved in", dateEA(`${t.moveInDate}T12:00:00+03:00`)],
    ["Paid through", t.paidThrough ? monthName(t.paidThrough) : "Nothing paid yet"],
    ...(sc?.type === "till" && t.alsoPaysFrom ? [["Also pays from", t.alsoPaysFrom] as [string, React.ReactNode]] : []),
  ];

  return (
    <>
      <BackLink href="/tenants">All tenants</BackLink>
      <PageHeader title={t.name} description={`${b.name}${t.houseNo ? ` · ${t.houseNo}` : ""}`}
        actions={<TenantActions id={t.id} name={t.name} rent={t.rentAmount} active={active} today={todayEA()} />} />
      <div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge status={status} />{sc && <ShortcodeBadge type={sc.type} number={sc.number} label={sc.label} />}</div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Monthly rent", value: money(t.rentAmount), sub: "Due every month" },
          { label: "Balance", value: active && s.balance ? money(s.balance) : "None", sub: active && s.monthsOwed > 0 ? `${s.monthsOwed} month${s.monthsOwed === 1 ? "" : "s"} unpaid` : active ? "Up to date" : "Moved out" },
          { label: "Credit carried", value: money(t.creditBalance), sub: "Part-paid towards next month" },
        ].map((x) => (
          <Card key={x.label} className="metric-card">
            <CardContent className="p-4 sm:p-5">
              <span className="eyebrow">{x.label}</span>
              <div className={`mt-3 font-display text-[24px] font-medium tracking-tight ${x.label === "Balance" && active && s.balance ? "text-destructive" : ""}`}>{x.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{x.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-5">
          <Card className="panel-card">
            <div className="border-b px-4 py-4 sm:px-5"><h2 className="font-display text-[18px]">Details</h2></div>
            <dl className="px-4 py-2 sm:px-5">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-border py-3 text-sm last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
          </Card>

          <Card className="panel-card">
            <div className="border-b px-4 py-4 sm:px-5"><h2 className="font-display text-[18px]">How they pay</h2></div>
            <div className="px-4 py-4 text-sm sm:px-5">
              {!sc ? <p className="text-muted-foreground">This building has no paybill or till attached yet.</p> : sc.type === "paybill" ? (
                <>
                  <p className="text-muted-foreground">Paybill <span className="font-mono text-foreground">{sc.number}</span> · account number</p>
                  <p className="mt-1.5 font-mono text-lg font-semibold tracking-wide">{t.accountRef ?? "—"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Payments with this account number are matched to {t.name.split(" ")[0]} automatically.</p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">Till <span className="font-mono text-foreground">{sc.number}</span></p>
                  <p className="mt-2 text-xs text-muted-foreground">Till payments carry no account number, so they are matched from the payer’s name, phone digits and amount. Anything unsure waits in the till inbox on the Payments page, or use <strong>Mark as paid</strong>.</p>
                </>
              )}
            </div>
          </Card>

          {sc?.type === "till" && (
            <Card className="panel-card">
              <div className="border-b px-4 py-4 sm:px-5">
                <h2 className="font-display text-[18px]">Known payers</h2>
                <p className="mt-1 text-xs text-muted-foreground">People the app recognises as paying this tenant’s rent. It learns from payments you assign or confirm.</p>
              </div>
              {d.aliases.length === 0 ? <p className="px-4 py-4 text-xs text-muted-foreground sm:px-5">None yet. The first payment from each payer is assigned by you.</p>
                : <KnownPayers payers={d.aliases.map((a) => ({ id: a.id, name: a.payerName, masked: a.maskedMsisdn, confirmed: a.confirmedCount, blocked: a.blocked }))} />}
            </Card>
          )}
        </div>

        <Card className="panel-card self-start">
          <div className="border-b px-4 py-4 sm:px-5"><h2 className="font-display text-[18px]">Payment history <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">{d.paymentCount}</span></h2></div>
          {d.history.length === 0 ? <EmptyState icon={Receipt} title="No payments yet" description="Payments appear here once they are matched or marked as paid." /> : (
            <ul>
              {d.history.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 border-t border-border px-4 py-3.5 first:border-t-0 sm:px-5">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-medium">{p.receipt}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{p.time} · {SOURCE[p.source]}</div>
                    {p.autoMethod && <MatchBadge paymentId={p.id} reason={p.autoReason} />}
                    {p.periods.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{p.periods.map((m) => <Badge key={m} variant="secondary" className="font-normal">{monthName(m)}</Badge>)}</div>}
                  </div>
                  <div className="text-sm font-semibold">{money(p.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
