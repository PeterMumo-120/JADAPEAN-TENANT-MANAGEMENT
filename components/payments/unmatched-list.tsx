"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/format";
import { assignPayment, ignorePayment } from "@/lib/payments/actions";
import type { TenantOption, UnmatchedItem } from "@/lib/payments/queries";
import type { ActionResult } from "@/lib/action-result";

const selectClass = "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-9 md:text-xs";

export function UnmatchedList({ items, tenants }: { items: UnmatchedItem[]; tenants: TenantOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<Record<string, string>>({});

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
    <ul>
      {items.map((p) => {
        // Only offer tenants who pay to the same paybill/till as this payment. If the shortcode is unknown, offer everyone.
        const options = p.shortcodeId ? tenants.filter((t) => t.shortcodeId === p.shortcodeId) : tenants;
        const isTill = p.shortcodeType === "till";
        return (
          <li key={p.id} className="border-t border-border px-4 py-4 first:border-t-0 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-medium">{money(p.amount)} <span className="font-normal text-muted-foreground">from {p.payer}</span></span>
              {p.shortcodeNumber && <Badge variant="outline" className="font-normal">{isTill ? "Till" : p.shortcodeType === "paybill" ? "Paybill" : "Shortcode"} {p.shortcodeNumber}</Badge>}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {isTill ? "Till payment" : <>Account typed: <span className="font-mono">{p.billRef ?? "none"}</span></>} · <span className="font-mono">{p.receipt}</span> · {p.time}
            </div>
            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              <select aria-label={`Assign payment ${p.receipt} to a tenant`} className={selectClass} value={choice[p.id] ?? ""} onChange={(e) => setChoice({ ...choice, [p.id]: e.target.value })}>
                <option value="">{options.length ? "Assign to a tenant…" : "No tenants on this paybill/till"}</option>
                {options.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <div className="flex gap-2">
                <Button disabled={!choice[p.id] || pending} className="h-11 flex-1 bg-primary text-white hover:bg-primary/90 md:h-9 md:flex-none" onClick={() => run(() => assignPayment(p.id, choice[p.id]))}>Assign</Button>
                <Button variant="ghost" disabled={pending} className="h-11 flex-1 md:h-9 md:flex-none" onClick={() => run(() => ignorePayment(p.id))}>Ignore</Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
