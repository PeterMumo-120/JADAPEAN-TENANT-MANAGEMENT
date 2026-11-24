export const money = (amount: number) => `KES ${amount.toLocaleString("en-KE")}`;

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const initials = (first: string, last: string) =>
  `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();

export const dateEA = (d: Date | string | number) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date(d));

/** Today's date in Nairobi as YYYY-MM-DD (for date inputs). */
export function todayEA(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Canonical form used to compare account numbers: "kc-b 204" and "KCB204" are the same. */
export const normaliseRef = (s: string) => s.toUpperCase().replace(/[\s-]/g, "");


const EAT = "Africa/Nairobi";
/** "Today, 2:14 PM", "Yesterday, 9:02 AM" or "12 Nov, 4:30 PM" in Nairobi time. */
export function formatWhen(d: Date, now = new Date()): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: EAT, hour: "numeric", minute: "2-digit", hour12: true }).format(d).toUpperCase();
  if (todayEA(d) === todayEA(now)) return `Today, ${time}`;
  if (todayEA(d) === todayEA(new Date(now.getTime() - 864e5))) return `Yesterday, ${time}`;
  return `${new Intl.DateTimeFormat("en-GB", { timeZone: EAT, day: "numeric", month: "short" }).format(d)}, ${time}`;
}

/** 8600000 -> "8.6M", 250000 -> "250K". */
export const compactNumber = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
