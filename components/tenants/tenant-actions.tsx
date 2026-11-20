"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, DoorOpen, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MarkPaidDialog } from "@/components/tenants/mark-paid-dialog";
import { deleteTenant, moveOutTenant } from "@/lib/tenants/actions";
import type { ActionResult } from "@/lib/action-result";

/** Mark as paid, edit, move out and delete for one tenant, shown on their own page. */
export function TenantActions({ id, name, rent, active, today }: { id: string; name: string; rent: number; active: boolean; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [paidOpen, setPaidOpen] = useState(false);
  const [confirm, setConfirm] = useState<"moveout" | "delete" | null>(null);

  function run(fn: () => Promise<ActionResult>, after: "stay" | "list") {
    setConfirm(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        if (after === "list") router.push("/tenants");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {active && <Button className="col-span-2 h-10 bg-primary text-white hover:bg-primary/90 sm:col-span-1 sm:h-9" onClick={() => setPaidOpen(true)}><Banknote className="mr-1.5 size-4" />Mark as paid</Button>}
        <Button variant="outline" className="h-10 sm:h-9" render={<Link href={`/tenants/${id}/edit`} />}><Pencil className="mr-1.5 size-4" />Edit</Button>
        {active && <Button variant="outline" className="h-10 sm:h-9" disabled={pending} onClick={() => setConfirm("moveout")}><DoorOpen className="mr-1.5 size-4" />Move out</Button>}
        <Button variant="outline" className={`h-10 text-destructive hover:text-destructive sm:h-9 ${active ? "col-span-2 sm:col-span-1" : ""}`} disabled={pending} onClick={() => setConfirm("delete")}><Trash2 className="mr-1.5 size-4" />Delete</Button>
      </div>

      <MarkPaidDialog open={paidOpen} onOpenChange={setPaidOpen} tenantId={id} tenantName={name} rent={rent} today={today} />

      <AlertDialog open={confirm === "moveout"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {name} as moved out?</AlertDialogTitle>
            <AlertDialogDescription>Their house becomes available again. Payment history is kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep tenant</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => run(() => moveOutTenant(id), "stay")}>Mark as moved out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>This can’t be undone. Tenants who have payment history can’t be deleted. Use “Mark as moved out” for them.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep tenant</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => run(() => deleteTenant(id), "list")}>Delete tenant</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
