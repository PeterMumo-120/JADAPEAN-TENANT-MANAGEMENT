export type RentStatus = "Paid" | "Pending" | "Overdue";

const idx = (period: string) => { const [y, m] = period.split("-").map(Number); return y * 12 + m - 1; };

/** Current month as YYYY-MM in Nairobi time. */
export function currentPeriod(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
}

/**
 * Derived, never stored: how many months are unpaid, what is owed, and the resulting status.
 * Paid = nothing owed, Pending = only this month is unpaid, Overdue = an earlier month is unpaid too.
 */
export function rentSummary(
  t: { rentAmount: number; paidThrough: string | null; moveInDate: string; creditBalance: number },
  now = new Date(),
): { status: RentStatus; balance: number; monthsOwed: number } {
  const cur = idx(currentPeriod(now));
  const moveIn = idx(t.moveInDate.slice(0, 7));
  const baseline = t.paidThrough ? idx(t.paidThrough) : moveIn - 1;
  const monthsOwed = Math.max(0, cur - baseline);
  const balance = Math.max(0, monthsOwed * t.rentAmount - t.creditBalance);
  const status: RentStatus = moveIn > cur ? "Pending" : monthsOwed === 0 ? "Paid" : monthsOwed === 1 ? "Pending" : "Overdue";
  return { status, balance, monthsOwed };
}
