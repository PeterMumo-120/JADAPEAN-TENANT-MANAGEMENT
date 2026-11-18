import Link from "next/link";
import { ArrowUpRight, Building2, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getBuildingStats } from "@/lib/buildings/queries";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/page-header";
import { PrimaryLink } from "@/components/layout/primary-link";

export default async function BuildingsPage() {
  await requireAdmin();
  const buildings = await getBuildingStats();
  return (
    <>
      <PageHeader title="Buildings" description="Every building, how full it is and how much it has collected."
        actions={buildings.length ? <PrimaryLink href="/buildings/new">Add building</PrimaryLink> : undefined} />
      {buildings.length === 0 ? (
        <Card className="panel-card mt-6">
          <EmptyState icon={Building2} title="No buildings yet"
            description="Add your first building to start adding tenants and tracking rent."
            action={<PrimaryLink href="/buildings/new">Add building</PrimaryLink>} />
        </Card>
      ) : (
        <div className="property-card-grid mt-6">
          {buildings.map((b, i) => {
            const pct = b.target > 0 ? Math.round((b.collected / b.target) * 100) : null;
            return (
              <Link key={b.id} href={`/buildings/${b.id}/edit`} className="block" aria-label={`Edit ${b.name}`}>
                <Card className="panel-card overflow-hidden transition-shadow hover:shadow-md">
                  <div className={`building-cover building-cover-${(i % 4) + 1}`}>
                    <span className="building-cover-icon"><Building2 className="size-5" /></span>
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-primary">{b.occupied >= b.totalUnits ? "Full" : "Active"}</span>
                  </div>
                  <CardContent className="p-5">
                    <h2 className="font-display text-[19px] font-medium">{b.name}</h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><ArrowUpRight className="size-3" />{b.address ?? "No area set"}</p>
                    <div className="mt-5 flex items-center justify-between">
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
          <Link href="/buildings/new" className="add-property-card">
            <span className="flex size-10 items-center justify-center rounded-full border border-dashed border-primary/40"><Plus className="size-4" /></span>
            <span className="text-xs font-medium">Add a building</span>
            <span className="text-xs text-muted-foreground">Name it and set how many houses it has</span>
          </Link>
        </div>
      )}
    </>
  );
}
