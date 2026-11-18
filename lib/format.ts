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

/** Suggested paybill account number from the building and house, e.g. Kijani Court + B-204 -> KC-B-204. */
export function suggestAccountRef(buildingName: string, houseNo?: string): string {
  const house = (houseNo ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!house) return "";
  const words = buildingName.trim().split(/\s+/).filter(Boolean);
  const prefix = (words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}-${house}`.slice(0, 20);
}
