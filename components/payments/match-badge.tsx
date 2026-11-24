"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { confirmMatch, undoMatch } from "@/lib/payments/actions";
import type { ActionResult } from "@/lib/action-result";

/** Shown on payments the app assigned by itself: why it did, with one-tap Confirm and Undo. */
export function MatchBadge({ paymentId, reason }: { paymentId: string; reason: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<ActionResult>) {
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  const btn = "inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="max-w-full gap-1 truncate font-normal text-primary"><Sparkles className="size-3 shrink-0" /><span className="truncate">Matched automatically{reason ? ` · ${reason}` : ""}</span></Badge>
      <button type="button" className={btn} disabled={pending} onClick={() => run(() => confirmMatch(paymentId))}>{pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Confirm</button>
      <button type="button" className={`${btn} text-destructive`} disabled={pending} onClick={() => run(() => undoMatch(paymentId))}><Undo2 className="size-3" />Undo</button>
    </div>
  );
}
