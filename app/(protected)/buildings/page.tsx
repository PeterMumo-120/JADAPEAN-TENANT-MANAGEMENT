import Link from "next/link";
import { ArrowUpRight, Building2, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { countArchivedBuildings, getBuildingStats } from "@/lib/buildings/queries";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/page-header";
import { PrimaryLink } from "@/components/layout/primary-link";
import { ShortcodeBadge } from "@/components/shortcodes/shortcode-badge";

export default async function BuildingsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  await requireAdmin();
  const showArchived = (await searchParams).archived === "1";
  const [all, archivedCount] = await Promise.all([getBuildingStats({ includeArchived: showArchived }), countArchivedBuildings()]);
  const buildings = showArchived ? all.filter((b) => b.archived) : all;
  return (
    <>
      <PageHeader title="Buildings" description={showArchived ? "Archived buildings. Open one to restore it." : "Every building, how full it is and how much it has collected."}
        actions={!showArchived && buildings.length ? <PrimaryLink href="/buildings/new">Add building</PrimaryLink> : undefined} />
      {(archivedCount > 0 || showArchived) && (
        <div className="mt-4 flex gap-2 text-xs">
          <Link href="/buildings" className={`rounded-full border px-3 py-1.5 ${!showArchived ? "border-primary bg-accent font-medium text-primary" : "border-border text-muted-foreground"}`}>Active</Link>
          <Link href="/buildings?archived=1" className={`rounded-full border px-3 py-1.5 ${showArchived ? "border-primary bg-accent font-medium text-primary" : "border-border text-muted-foreground"}`}>Archived ({archivedCount})</Link>
        </div>
      )}
      {buildings.length === 0 ? (
        <Card className="panel-card mt-6">
          <EmptyState icon={Building2} title={showArchived ? "Nothing archived" : "No buildings yet"}
            description={showArchived ? "Buildings you archive will be listed here." : "Add your first building to start adding tenants and tracking rent."}
            action={showArchived ? undefined : <PrimaryLink href="/buildings/new">Add building</PrimaryLink>} />
        </Card>
      ) : (
        <div className="property-card-grid mt-6">
          {buildings.map((b, i) => {
            const pct = b.target > 0 ? Math.round((b.collected / b.target) * 100) : null;
            return (
              <Link key={b.id} href={`/buildings/${b.id}`} className="block" aria-label={`Open ${b.name}`}>
                <Card className="panel-card overflow-hidden transition-shadow hover:shadow-md">
                  <div className={`building-cover building-cover-${(i % 4) + 1}`}>
                    <span className="building-cover-icon"><Building2 className="size-5" /></span>
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-primary">{b.archived ? "Archived" : b.occupied >= b.totalUnits ? "Full" : "Active"}</span>
                  </div>
                  <CardContent className="p-5">
                    <h2 className="font-display text-[19px] font-medium">{b.name}</h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><ArrowUpRight className="size-3" />{b.address ?? "No area set"}</p>
                    <div className="mt-3">{b.shortcode ? <ShortcodeBadge type={b.shortcode.type} number={b.shortcode.number} /> : <Badge variant="outline" className="font-normal">No paybill or till yet</Badge>}</div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Occupancy</span>
                      <span className="text-xs font-semibold">{b.occupied} <span className="font-normal text-muted-foreground">/ {b.totalUnits} houses</span></span>
                    </div>
                    <div className="progress-track mt-2"><div className="progress-fill" style={{ width: `${Math.min(100, (b.occupied / b.totalUnits) * 100)}%` }} /></div>
                    <Separator className="my-4" />
                    <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Collected this month</span><span className="text-xs font-semibold">{money(b.collected)}</span></div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">of {money(b.target)} expected</span>
                      <Badge variant="secondary" className="text-xs text-primary">{pct === null ? "—" : `${pct}%`}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {!showArchived && (
            <Link href="/buildings/new" className="add-property-card">
              <span className="flex size-10 items-center justify-center rounded-full border border-dashed border-primary/40"><Plus className="size-4" /></span>
              <span className="text-xs font-medium">Add a building</span>
              <span className="text-xs text-muted-foreground">Name it, set its houses and pick its paybill or till</span>
            </Link>
          )}
        </div>
      )}
    </>
  );
}
