"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { approveAdmin, reinstateAdmin, rejectAdmin, suspendAdmin, type AdminActionResult } from "@/lib/admins/actions";

export type AdminRow = { id: string; name: string; initials: string; phone: string; status: "pending" | "approved" | "suspended"; requested: string; lastLogin: string };
type Confirm = { kind: "reject" | "suspend"; row: AdminRow } | null;

export function AdminsPanel({ currentId, pending, members }: { currentId: string; pending: AdminRow[]; members: AdminRow[] }) {
  const [busy, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  function run(id: string, fn: () => Promise<AdminActionResult>) {
    setActiveId(id);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) toast.success(r.message); else toast.error(r.message);
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <Tabs defaultValue={pending.length ? "requests" : "admins"}>
        <TabsList>
          <TabsTrigger value="requests">Access requests{pending.length > 0 && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">{pending.length}</span>}</TabsTrigger>
          <TabsTrigger value="admins">Admins ({members.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card className="panel-card mt-3">
            {pending.length ? (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="pl-5">Person</TableHead><TableHead>Requested</TableHead><TableHead className="pr-5 text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pending.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5"><Person row={r} /></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.requested}</TableCell>
                      <TableCell className="pr-5 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({ kind: "reject", row: r })}><X className="mr-1 size-3.5" />Reject</Button>
                          <Button size="sm" disabled={busy} className="bg-primary text-white hover:bg-primary/90" onClick={() => run(r.id, () => approveAdmin(r.id))}>
                            {busy && activeId === r.id ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Check className="mr-1 size-3.5" />}Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            ) : (
              <EmptyState icon={ShieldCheck} title="No pending requests" description="When someone registers on the sign-in page, they will appear here for approval." />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="admins">
          <Card className="panel-card mt-3">
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="pl-5">Person</TableHead><TableHead>Status</TableHead><TableHead>Last sign-in</TableHead><TableHead className="pr-5 text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {members.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-5"><Person row={r} you={r.id === currentId} /></TableCell>
                    <TableCell><Badge variant="outline" className={`status-badge ${r.status === "approved" ? "status-paid" : "status-overdue"}`}><span className="mr-1.5 size-1.5 rounded-full bg-current" />{r.status === "approved" ? "Active" : "Suspended"}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.lastLogin}</TableCell>
                    <TableCell className="pr-5 text-right">
                      {r.id === currentId ? null : r.status === "approved"
                        ? <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({ kind: "suspend", row: r })}>Suspend</Button>
                        : <Button size="sm" variant="outline" disabled={busy} onClick={() => run(r.id, () => reinstateAdmin(r.id))}>Restore access</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "reject" ? "Reject this request?" : "Suspend this admin?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "reject"
                ? `${confirm?.row.name}’s request will be deleted. They can register again.`
                : `${confirm?.row.name} will be signed out immediately and will not be able to sign in until you restore access.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => {
              if (!confirm) return;
              const { kind, row } = confirm; setConfirm(null);
              run(row.id, () => (kind === "reject" ? rejectAdmin(row.id) : suspendAdmin(row.id)));
            }}>{confirm?.kind === "reject" ? "Reject request" : "Suspend admin"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Person({ row, you }: { row: AdminRow; you?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="avatar-initials size-8 bg-accent text-primary">{row.initials}</div>
      <div>
        <div className="whitespace-nowrap text-xs font-medium">{row.name}{you && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{row.phone}</div>
      </div>
    </div>
  );
}
