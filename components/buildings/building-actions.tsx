"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteBuilding, setBuildingArchived } from "@/lib/buildings/actions";
import type { ActionResult } from "@/lib/action-result";

/** Edit, archive/restore and delete for one building, shown on its own page. */
export function BuildingActions({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<"delete" | "archive" | null>(null);

  function run(fn: () => Promise<ActionResult>, after: "stay" | "list") {
    setConfirm(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        if (after === "list") router.push("/buildings");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button variant="outline" className="h-10 sm:h-9" render={<Link href={`/buildings/${id}/edit`} />}><Pencil className="mr-1.5 size-4" />Edit</Button>
        {archived ? (
          <Button variant="outline" className="h-10 sm:h-9" disabled={pending} onClick={() => run(() => setBuildingArchived(id, false), "stay")}>
            {pending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <ArchiveRestore className="mr-1.5 size-4" />}Restore
          </Button>
        ) : (
          <Button variant="outline" className="h-10 sm:h-9" disabled={pending} onClick={() => setConfirm("archive")}><Archive className="mr-1.5 size-4" />Archive</Button>
        )}
        <Button variant="outline" className="col-span-2 h-10 text-destructive hover:text-destructive sm:col-span-1 sm:h-9" disabled={pending} onClick={() => setConfirm("delete")}><Trash2 className="mr-1.5 size-4" />Delete</Button>
      </div>

      <AlertDialog open={confirm === "archive"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {name}?</AlertDialogTitle>
            <AlertDialogDescription>It disappears from your lists and can’t get new tenants. All history is kept and you can restore it later. Buildings with active tenants can’t be archived.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(() => setBuildingArchived(id, true), "stay")}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>This can’t be undone. Buildings that have tenants on record can’t be deleted. Archive them instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep building</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => run(() => deleteBuilding(id), "list")}>Delete building</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
