import { money } from "@/lib/format";
import type { TillTotals } from "@/lib/payments/till-queries";

/** Per-till figures for this month, to compare with the till's M-Pesa statement. */
export function TillTotalsGrid({ totals }: { totals: TillTotals[] }) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
      {totals.map((t) => (
        <div key={t.shortcodeId} className="rounded-xl border border-border p-4">
          <div className="text-sm font-medium">{t.label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Till {t.number} · {t.count} payment{t.count === 1 ? "" : "s"}</div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-muted-foreground">Received</dt><dd className="mt-0.5 text-[13px] font-semibold">{money(t.received)}</dd></div>
            <div><dt className="text-muted-foreground">Matched</dt><dd className="mt-0.5 text-[13px] font-semibold text-primary">{money(t.assigned)}</dd></div>
            <div><dt className="text-muted-foreground">Not matched yet</dt><dd className={`mt-0.5 text-[13px] font-semibold ${t.unassigned ? "text-destructive" : "text-muted-foreground"}`}>{money(t.unassigned)}</dd></div>
          </dl>
        </div>
      ))}
    </div>
  );
}
