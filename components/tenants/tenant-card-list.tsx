import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/tenants/status-badge";
import { money } from "@/lib/format";
import type { TenantRow } from "@/components/tenants/tenants-table";

/** Phones and small tablets: one tappable card per tenant, instead of a cramped table. */
export function TenantCardList({ rows }: { rows: TenantRow[] }) {
  return (
    <ul className="flex flex-col gap-3 p-3 sm:grid sm:grid-cols-2 sm:p-4">
      {rows.map((t) => (
        <li key={t.id}>
          <Link href={`/tenants/${t.id}`} className="block rounded-xl border border-border bg-card p-4 transition-colors active:bg-muted/50 hover:border-primary/30">
            <div className="flex items-start gap-3">
              <div className="avatar-initials size-10 shrink-0 bg-accent text-primary">{t.initials}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold leading-tight">{t.name}</div>
                <div className="mt-1 truncate text-[13px] text-muted-foreground">{t.building}{t.houseNo ? ` · ${t.houseNo}` : ""}</div>
              </div>
              <StatusBadge status={t.status} />
            </div>
            <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3.5">
              <div><dt className="text-xs text-muted-foreground">Monthly rent</dt><dd className="mt-0.5 text-sm font-semibold">{money(t.rent)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Balance</dt><dd className={`mt-0.5 text-sm font-semibold ${t.balance ? "text-destructive" : "text-muted-foreground"}`}>{t.balance ? money(t.balance) : "None"}</dd></div>
              <div className="col-span-2 flex items-center justify-between gap-2">
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Pays via</dt><dd className="mt-0.5 truncate font-mono text-xs">{t.payVia}</dd></div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}
