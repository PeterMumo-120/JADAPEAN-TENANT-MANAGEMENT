"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { assignPayment, ignorePayment } from "@/lib/payments/actions";
import type { TillGroup } from "@/lib/payments/till-queries";
import type { ActionResult } from "@/lib/action-result";

const selectClass = "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-9 md:text-xs";

/** One section per till. The best guess is already selected, so a correct suggestion is a single tap on Assign. */
export function TillInbox({ groups }: { groups: TillGroup[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<Record<string, string>>(() => {
    const c: Record<string, string> = {};
    for (const g of groups) for (const i of g.items) if (i.suggestion) c[i.id] = i.suggestion.tenantId;
    return c;
  });

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

  return (
    <div>
      {groups.map((g) => (
        <section key={g.shortcodeId} className="border-t border-border first:border-t-0">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 sm:px-5">
            <div className="text-sm font-medium">{g.label} <span className="font-normal text-muted-foreground">· Till {g.number}</span></div>
          </div>
          <ul>
            {g.items.map((p) => (
              <li key={p.id} className="border-t border-border px-4 py-4 first:border-t-0 sm:px-5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{money(p.amount)}</span>
                  <span className="text-sm text-muted-foreground">from {p.payer}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground"><span className="font-mono">{p.receipt}</span> · {p.time}</div>

                {p.ambiguousPayer ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"><Lightbulb className="mt-0.5 size-3.5 shrink-0" />This person has paid for more than one tenant, so please choose.</p>
                ) : p.suggestion ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-primary"><Lightbulb className="mt-0.5 size-3.5 shrink-0" />Looks like <strong className="font-medium">{p.suggestion.label}</strong> <span className="text-muted-foreground">({p.suggestion.reasons.join(" + ")})</span></p>
                ) : null}

                <div className="mt-3 flex flex-col gap-2 md:flex-row">
                  <select aria-label={`Assign payment ${p.receipt} to a tenant`} className={selectClass} value={choice[p.id] ?? ""} onChange={(e) => setChoice({ ...choice, [p.id]: e.target.value })}>
                    <option value="">{g.tenants.length ? "Choose a tenant…" : "No tenants on this till yet"}</option>
                    {g.tenants.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <Button disabled={!choice[p.id] || pending} className="h-11 flex-1 bg-primary text-white hover:bg-primary/90 md:h-9 md:flex-none" onClick={() => run(() => assignPayment(p.id, choice[p.id]))}>
                      {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}Assign
                    </Button>
                    <Button variant="ghost" disabled={pending} className="h-11 flex-1 md:h-9 md:flex-none" onClick={() => run(() => ignorePayment(p.id))}>Ignore</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
