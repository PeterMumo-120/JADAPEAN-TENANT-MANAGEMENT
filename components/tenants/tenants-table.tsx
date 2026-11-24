"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight, Search, SearchX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrimaryLink } from "@/components/layout/primary-link";
import { StatusBadge } from "@/components/tenants/status-badge";
import { TenantCardList } from "@/components/tenants/tenant-card-list";
import { money } from "@/lib/format";
import type { RentStatus } from "@/lib/tenants/status";

export type TenantRow = {
  id: string; name: string; initials: string; phone: string; building: string; buildingId: string; area: string | null;
  houseNo: string | null; payVia: string; rent: number; balance: number; status: RentStatus | "Moved out";
};

const PAGE_SIZE = 8;
const FILTERS = ["Active", "Owing", "Paid", "Pending", "Overdue", "Moved out"] as const;
export type TenantFilter = (typeof FILTERS)[number];

const selectClass = "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-9 md:w-[170px] md:text-xs";

/** Search, filter and paging run in the browser, which is fine for a few hundred tenants. */
export function TenantsTable({ rows, hasBuildings, buildingOptions, initialFilter = "Active" }: { rows: TenantRow[]; hasBuildings: boolean; buildingOptions: { id: string; name: string }[]; initialFilter?: TenantFilter }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TenantFilter>(initialFilter);
  const [building, setBuilding] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((t) =>
      (filter === "Active" ? t.status !== "Moved out" : filter === "Owing" ? t.status !== "Moved out" && t.balance > 0 : t.status === filter) &&
      (!building || t.buildingId === building) &&
      (!q || [t.name, t.houseNo ?? "", t.phone, t.building, t.payVia].some((f) => f.toLowerCase().includes(q))));
  }, [rows, search, filter, building]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Active: 0, Owing: 0, Paid: 0, Pending: 0, Overdue: 0, "Moved out": 0 };
    for (const t of rows) { if (t.status !== "Moved out") { c.Active++; if (t.balance > 0) c.Owing++; } c[t.status]++; }
    return c;
  }, [rows]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  if (rows.length === 0) {
    return (
      <Card className="panel-card mt-6">
        <EmptyState icon={Users} title="No tenants yet"
          description={hasBuildings ? "Add your first tenant to start tracking their rent." : "Add a building first, then you can add the tenants who live in it."}
          action={hasBuildings ? <PrimaryLink href="/tenants/new">Add tenant</PrimaryLink> : <PrimaryLink href="/buildings/new">Add building</PrimaryLink>} />
      </Card>
    );
  }

  const empty = <EmptyState icon={SearchX} title="No tenants found" description="Try a different search, status or building." />;

  return (
    <Card className="panel-card mt-6">
      {/* Toolbar: search on its own row, status chips that scroll sideways, building filter */}
      <div className="flex flex-col gap-3 border-b border-border px-3 py-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[18px] font-medium tracking-tight">All tenants <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">{rows.length}</span></h2>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative md:w-[260px]">
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground md:top-2.5 md:size-3.5" />
            <Input aria-label="Search tenants" placeholder="Search name, house, phone…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-11 pl-9 text-sm md:h-9 md:text-xs" />
          </div>
          {buildingOptions.length > 1 && (
            <select aria-label="Filter by building" className={selectClass} value={building} onChange={(e) => { setBuilding(e.target.value); setPage(1); }}>
              <option value="">All buildings</option>
              {buildingOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => { setFilter(f); setPage(1); }}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] transition-colors md:py-1.5 md:text-xs ${filter === f ? "border-primary bg-primary font-medium text-white" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
              {f} <span className={filter === f ? "text-white/75" : "text-muted-foreground/70"}>{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Small screens: cards */}
      <div className="md:hidden">{pageRows.length ? <TenantCardList rows={pageRows} /> : empty}</div>

      {/* md and up: table */}
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Tenant</TableHead><TableHead>Building / house</TableHead><TableHead className="hidden lg:table-cell">Pays via</TableHead>
              <TableHead>Monthly rent</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead className="w-10 pr-5"><span className="sr-only">Open</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length ? pageRows.map((t) => (
              <TableRow key={t.id} className="cursor-pointer">
                <TableCell className="pl-5">
                  <Link href={`/tenants/${t.id}`} className="flex items-center gap-2.5">
                    <div className="avatar-initials size-8 bg-accent text-primary">{t.initials}</div>
                    <div><div className="whitespace-nowrap text-xs font-medium">{t.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{t.phone}</div></div>
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="whitespace-nowrap text-xs font-medium">{t.building}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t.houseNo ?? "No house number"}{t.area ? ` · ${t.area}` : ""}</div>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap font-mono text-xs lg:table-cell">{t.payVia}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{money(t.rent)}</TableCell>
                <TableCell className="whitespace-nowrap text-xs font-medium">{t.balance ? money(t.balance) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="pr-5 text-right"><Link href={`/tenants/${t.id}`} aria-label={`Open ${t.name}`}><ChevronRight className="size-4 text-muted-foreground" /></Link></TableCell>
              </TableRow>
            )) : <TableRow className="hover:bg-transparent"><TableCell colSpan={7}>{empty}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span className="text-center text-xs text-muted-foreground sm:text-left">Showing {filtered.length ? (current - 1) * PAGE_SIZE + 1 : 0}–{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length} tenants</span>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:gap-1">
          <Button variant="outline" size="sm" className="h-11 px-2.5 text-sm md:h-7 md:text-xs" disabled={current <= 1} onClick={() => setPage(current - 1)}><ArrowLeft className="mr-1 size-3" />Previous</Button>
          <span className="px-2 text-xs text-muted-foreground">{current} / {pages}</span>
          <Button variant="outline" size="sm" className="h-11 px-2.5 text-sm md:h-7 md:text-xs" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next<ArrowRight className="ml-1 size-3" /></Button>
        </div>
      </div>
    </Card>
  );
}
