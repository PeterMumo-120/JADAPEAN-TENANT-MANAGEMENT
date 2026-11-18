"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, MoreHorizontal, Search, SearchX, SlidersHorizontal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PrimaryLink } from "@/components/layout/primary-link";
import { StatusBadge } from "@/components/tenants/status-badge";
import { money } from "@/lib/format";
import { moveOutTenant } from "@/lib/tenants/actions";
import type { RentStatus } from "@/lib/tenants/status";

export type TenantRow = {
  id: string; name: string; initials: string; phone: string; building: string; area: string | null;
  houseNo: string | null; accountRef: string; rent: number; balance: number; status: RentStatus | "Moved out";
};

const PAGE_SIZE = 8;
const FILTERS = ["Active tenants", "Paid", "Pending", "Overdue", "Moved out"];

/** Search, filter and paging run in the browser, which is fine for a few hundred tenants. */
export function TenantsTable({ rows, hasBuildings }: { rows: TenantRow[]; hasBuildings: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Active tenants");
  const [page, setPage] = useState(1);
  const [toMoveOut, setToMoveOut] = useState<TenantRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((t) =>
      (filter === "Active tenants" ? t.status !== "Moved out" : t.status === filter) &&
      (!q || [t.name, t.houseNo ?? "", t.phone, t.building, t.accountRef].some((f) => f.toLowerCase().includes(q))));
  }, [rows, search, filter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function moveOut() {
    if (!toMoveOut) return;
    const id = toMoveOut.id;
    setToMoveOut(null);
    start(async () => {
      try {
        const r = await moveOutTenant(id);
        if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  const menu = (t: TenantRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" disabled={busy} aria-label={`Actions for ${t.name}`} className="size-11 md:size-8"><MoreHorizontal className="size-4" /></Button>} />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/tenants/${t.id}/edit`)}>Edit details</DropdownMenuItem>
        {t.status !== "Moved out" && <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setToMoveOut(t)}>Mark as moved out</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (rows.length === 0) {
    return (
      <Card className="panel-card mt-6">
        <EmptyState icon={Users} title="No tenants yet"
          description={hasBuildings ? "Add your first tenant to start tracking their rent." : "Add a building first, then you can add the tenants who live in it."}
          action={hasBuildings ? <PrimaryLink href="/tenants/new">Add tenant</PrimaryLink> : <PrimaryLink href="/buildings/new">Add building</PrimaryLink>} />
      </Card>
    );
  }

  return (
    <>
      <Card className="panel-card mt-6">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-display text-[18px] font-medium tracking-tight">All tenants <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">{rows.length}</span></h2>
            <p className="mt-1 text-xs text-muted-foreground">Search and manage residents across your buildings.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-auto sm:min-w-[170px] sm:flex-1 md:flex-none">
              <Search className="absolute left-3 top-3.5 size-3.5 text-muted-foreground md:left-2.5 md:top-2.5" />
              <Input aria-label="Search tenants" placeholder="Name, house, phone…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-11 pl-9 text-sm md:h-9 md:w-[205px] md:pl-8 md:text-xs" />
            </div>
            <Select value={filter} onValueChange={(v) => { setFilter(v ?? "Active tenants"); setPage(1); }}>
              <SelectTrigger className="h-11 w-full text-sm sm:w-[150px] md:h-9 md:text-xs"><SlidersHorizontal className="mr-1 size-3.5" /><SelectValue /></SelectTrigger>
              <SelectContent>{FILTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Tenant</TableHead><TableHead>Building / house</TableHead><TableHead className="hidden lg:table-cell">Account no.</TableHead>
                <TableHead>Monthly rent</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead className="pr-5 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length ? pageRows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-5">
                    <Link href={`/tenants/${t.id}/edit`} className="flex items-center gap-2.5">
                      <div className="avatar-initials size-8 bg-accent text-primary">{t.initials}</div>
                      <div><div className="whitespace-nowrap text-xs font-medium">{t.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{t.phone}</div></div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="whitespace-nowrap text-xs font-medium">{t.building}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{t.houseNo ?? "No house number"}{t.area ? ` · ${t.area}` : ""}</div>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap font-mono text-xs lg:table-cell">{t.accountRef}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{money(t.rent)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs font-medium">{t.balance ? money(t.balance) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="pr-4 text-right">
                    {menu(t)}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={7}>
                  <EmptyState icon={SearchX} title="No tenants found" description="Try a different search or status filter." />
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Phones: one card per tenant instead of a table */}
        <ul className="md:hidden">
          {pageRows.length ? pageRows.map((t) => (
            <li key={t.id} className="grid grid-cols-[40px_1fr_44px] gap-x-3 gap-y-1 border-t border-border py-4 pl-4 pr-2">
              <div className="avatar-initials size-10 bg-accent text-primary">{t.initials}</div>
              <Link href={`/tenants/${t.id}/edit`} className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{t.name}</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">{t.building} · {t.houseNo ?? "No house number"}</div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">{t.accountRef}</div>
              </Link>
              {menu(t)}
              <div className="col-span-2 col-start-2 mt-1.5 grid grid-cols-[1fr_1fr_auto] items-center gap-2 pr-2">
                <div><div className="text-sm font-semibold">{money(t.rent)}</div><div className="text-xs text-muted-foreground">Monthly rent</div></div>
                <div><div className="text-sm font-semibold">{t.balance ? money(t.balance) : "—"}</div><div className="text-xs text-muted-foreground">Balance</div></div>
                <StatusBadge status={t.status} />
              </div>
            </li>
          )) : (
            <li className="border-t border-border"><EmptyState icon={SearchX} title="No tenants found" description="Try a different search or status filter." /></li>
          )}
        </ul>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:gap-2">
          <span className="text-center text-xs text-muted-foreground sm:text-left">Showing {filtered.length ? (current - 1) * PAGE_SIZE + 1 : 0}–{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length} tenants</span>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:gap-1">
            <Button variant="outline" size="sm" className="h-11 px-2.5 text-sm md:h-7 md:text-xs" disabled={current <= 1} onClick={() => setPage(current - 1)}><ArrowLeft className="mr-1 size-3" />Previous</Button>
            <span className="px-2 text-xs text-muted-foreground">{current} / {pages}</span>
            <Button variant="outline" size="sm" className="h-11 px-2.5 text-sm md:h-7 md:text-xs" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next<ArrowRight className="ml-1 size-3" /></Button>
          </div>
        </div>
      </Card>

      <AlertDialog open={!!toMoveOut} onOpenChange={(o) => !o && setToMoveOut(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {toMoveOut?.name} as moved out?</AlertDialogTitle>
            <AlertDialogDescription>Their house becomes available again. Payment history is kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep tenant</AlertDialogCancel>
            <AlertDialogAction onClick={moveOut} className="bg-destructive text-white hover:bg-destructive/90">Mark as moved out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
