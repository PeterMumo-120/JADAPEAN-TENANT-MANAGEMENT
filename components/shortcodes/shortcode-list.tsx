"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, KeyRound, Link2, Loader2, Pencil, Power, RefreshCcw, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteShortcode, registerShortcodePull, registerShortcodeUrls, setShortcodeActive, testShortcodeKeys } from "@/lib/shortcodes/actions";
import type { ActionResult } from "@/lib/action-result";

export type ShortcodeCardData = {
  id: string; label: string; type: "paybill" | "till"; number: string; env: "sandbox" | "production"; active: boolean;
  hasKeys: boolean; keyPreview: string | null; nominatedNumber: string | null;
  urlsRegistered: string | null; pullRegistered: string | null; lastSync: string | null; lastSyncError: string | null;
  buildingCount: number; paymentCount: number;
};

function Step({ done, label, detail }: { done: boolean; label: string; detail?: string | null }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${done ? "bg-accent text-primary" : "bg-muted text-muted-foreground"}`}>
        {done ? <Check className="size-2.5" /> : <span className="size-1 rounded-full bg-current" />}
      </span>
      <span><span className="font-medium">{label}</span>{detail && <span className="text-muted-foreground"> · {detail}</span>}</span>
    </div>
  );
}

export function ShortcodeList({ items }: { items: ShortcodeCardData[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ShortcodeCardData | null>(null);
  const [toToggle, setToToggle] = useState<ShortcodeCardData | null>(null);

  function run(key: string, fn: () => Promise<ActionResult>) {
    setBusyKey(key);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setBusyKey(null);
      }
    });
  }

  const btn = (key: string, id: string, label: string, icon: React.ReactNode, fn: () => Promise<ActionResult>, disabled = false) => (
    <Button variant="outline" size="sm" className="h-9 justify-start gap-1.5 px-3 text-xs" disabled={pending || disabled} onClick={() => run(`${key}:${id}`, fn)}>
      {busyKey === `${key}:${id}` ? <Loader2 className="size-3.5 animate-spin" /> : icon}{label}
    </Button>
  );

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((s) => (
          <Card key={s.id} className="panel-card">
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 className="truncate font-display text-[18px] font-medium">{s.label}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{s.type === "till" ? "Till" : "Paybill"} {s.number}</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <Badge variant="outline">{s.type === "till" ? "Till" : "Paybill"}</Badge>
                <Badge variant={s.env === "production" ? "default" : "secondary"}>{s.env === "production" ? "Live" : "Sandbox"}</Badge>
                {!s.active && <Badge variant="destructive">Inactive</Badge>}
              </div>
            </div>

            <div className="grid gap-2.5 px-4 py-4 sm:px-5">
              <Step done={s.hasKeys} label="Daraja keys" detail={s.hasKeys ? s.keyPreview : "Not added yet"} />
              <Step done={!!s.urlsRegistered} label="Payment URLs registered" detail={s.urlsRegistered} />
              <Step done={!!s.pullRegistered} label="Pull sync registered" detail={s.pullRegistered ?? (s.nominatedNumber ? null : "Needs a nominated number")} />
              <p className="text-xs text-muted-foreground">
                {s.buildingCount} building{s.buildingCount === 1 ? "" : "s"} · {s.paymentCount} payment{s.paymentCount === 1 ? "" : "s"}
                {s.lastSync ? ` · last synced ${s.lastSync}` : ""}
              </p>
              {s.lastSyncError && (
                <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />{s.lastSyncError}</p>
              )}
              {s.type === "till" && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Till payments have no account number, so they are never matched automatically. Use <strong>Mark as paid</strong> on a tenant, or assign them on the Payments page.</p>}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border px-4 py-4 sm:grid-cols-3 sm:px-5">
              {btn("test", s.id, "Test keys", <KeyRound className="size-3.5" />, () => testShortcodeKeys(s.id), !s.hasKeys)}
              {btn("urls", s.id, s.urlsRegistered ? "Re-register URLs" : "Register URLs", <Link2 className="size-3.5" />, () => registerShortcodeUrls(s.id), !s.hasKeys)}
              {btn("pull", s.id, s.pullRegistered ? "Re-register Pull" : "Register Pull", <RefreshCcw className="size-3.5" />, () => registerShortcodePull(s.id), !s.hasKeys || !s.nominatedNumber)}
              <Button variant="outline" size="sm" className="h-9 justify-start gap-1.5 px-3 text-xs" render={<Link href={`/shortcodes/${s.id}/edit`} />}><Pencil className="size-3.5" />Edit</Button>
              <Button variant="outline" size="sm" className="h-9 justify-start gap-1.5 px-3 text-xs" disabled={pending} onClick={() => (s.active ? setToToggle(s) : run(`active:${s.id}`, () => setShortcodeActive(s.id, true)))}>
                <Power className="size-3.5" />{s.active ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="outline" size="sm" className="h-9 justify-start gap-1.5 px-3 text-xs text-destructive hover:text-destructive" disabled={pending} onClick={() => setToDelete(s)}><Trash2 className="size-3.5" />Delete</Button>
            </div>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!toToggle} onOpenChange={(o) => !o && setToToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {toToggle?.label}?</AlertDialogTitle>
            <AlertDialogDescription>It won’t be offered for new buildings and its automatic sync stops. Existing buildings, tenants and history are not affected, and you can activate it again any time.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep active</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const s = toToggle!; setToToggle(null); run(`active:${s.id}`, () => setShortcodeActive(s.id, false)); }}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.label}?</AlertDialogTitle>
            <AlertDialogDescription>This can’t be undone. A shortcode that buildings or payments use can’t be deleted. Deactivate it instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => { const s = toDelete!; setToDelete(null); run(`del:${s.id}`, () => deleteShortcode(s.id)); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
