import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getBuildingDetail } from "@/lib/buildings/queries";
import { money } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { rentSummary } from "@/lib/tenants/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { PrimaryLink } from "@/components/layout/primary-link";
import { BuildingActions } from "@/components/buildings/building-actions";
import { ShortcodeBadge } from "@/components/shortcodes/shortcode-badge";
import { StatusBadge } from "@/components/tenants/status-badge";

export default async function BuildingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const d = await getBuildingDetail(id);
  if (!d) notFound();
  const { building: b, shortcode: sc } = d;

  const active = d.tenants.filter((t) => t.status === "active");
  const movedOut = d.tenants.filter((t) => t.status === "moved_out");
  const target = active.reduce((a, t) => a + t.rentAmount, 0);
  const pct = target > 0 ? Math.round((d.collected / target) * 100) : null;
  const stats = [
    { label: "Occupancy", value: `${active.length} / ${b.totalUnits}`, sub: `${Math.max(b.totalUnits - active.length, 0)} vacant` },
    { label: "Collected this month", value: money(d.collected), sub: pct === null ? "No tenants yet" : `${pct}% of ${money(target)}` },
    { label: "Collects rent on", value: sc ? `${sc.type === "till" ? "Till" : "Paybill"} ${sc.number}` : "Not set", sub: sc ? sc.label : "Edit the building to attach one" },
  ];

  return (
    <>
      <BackLink href="/buildings">All buildings</BackLink>
      <PageHeader title={b.name} description={b.address ?? "No area set"} actions={<BuildingActions id={b.id} name={b.name} archived={!!b.archivedAt} />} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {b.archivedAt && <Badge variant="destructive">Archived</Badge>}
        {sc ? <ShortcodeBadge type={sc.type} number={sc.number} label={sc.label} /> : <Badge variant="outline">No paybill or till yet</Badge>}
        {sc?.type === "till" && <span className="text-xs text-muted-foreground">Till building: mark tenants as paid manually.</span>}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="metric-card">
            <CardContent className="p-4 sm:p-5">
              <span className="eyebrow">{s.label}</span>
              <div className="mt-3 font-display text-[24px] font-medium tracking-tight">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="panel-card mt-5">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-display text-[18px]">Tenants <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">{active.length} active</span></h2>
            {movedOut.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{movedOut.length} moved out · history kept</p>}
          </div>
          {!b.archivedAt && sc && <PrimaryLink href="/tenants/new">Add tenant</PrimaryLink>}
        </div>
        {active.length === 0 ? (
          <EmptyState icon={Users} title="No active tenants" description="Tenants you add to this building will appear here." />
        ) : (
          <ul>
            {active.map((t) => {
              const s = rentSummary(t);
              return (
                <li key={t.id} className="border-t border-border first:border-t-0">
                  <Link href={`/tenants/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.houseNo ?? "No house number"} · {formatPhone(t.phone)}{t.accountRef ? ` · ${t.accountRef}` : ""}</div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="text-xs font-medium">{money(t.rentAmount)}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{s.balance ? `${money(s.balance)} due` : "Up to date"}</div>
                    </div>
                    <StatusBadge status={s.status} />
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
