"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2, UserCheck } from "lucide-react";
import { forgetPayer } from "@/lib/payments/actions";

export type KnownPayer = { id: string; name: string | null; masked: string | null; confirmed: number; blocked: boolean };

/** What the app has learned about who pays this tenant's rent on the till. "Forget" resets it. */
export function KnownPayers({ payers }: { payers: KnownPayer[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function forget(id: string) {
    start(async () => {
      try {
        const r = await forgetPayer(id);
        if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <ul>
      {payers.map((p) => (
        <li key={p.id} className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 sm:px-5">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${p.blocked ? "bg-destructive/10 text-destructive" : "bg-accent text-primary"}`}>
            {p.blocked ? <Ban className="size-3.5" /> : <UserCheck className="size-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{p.name ?? "Unknown name"}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              <span className="font-mono">{p.masked}</span> · {p.blocked ? "Not this tenant (you undid a match)" : `Confirmed ${p.confirmed} time${p.confirmed === 1 ? "" : "s"}`}
            </div>
          </div>
          <button type="button" disabled={pending} onClick={() => forget(p.id)} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
            {pending && <Loader2 className="size-3 animate-spin" />}Forget
          </button>
        </li>
      ))}
    </ul>
  );
}
