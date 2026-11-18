/** 0712 345 678 / +254712345678 / 254712345678  ->  254712345678. Returns null if invalid. */
export function normalisePhone(input: string): string | null {
  const d = input.replace(/[\s\-()]/g, "");
  const p = d.startsWith("+") ? d.slice(1) : d.startsWith("0") ? "254" + d.slice(1) : d;
  return /^254[17]\d{8}$/.test(p) ? p : null;
}

/** 254712345678 -> 0712 345 678 */
export function formatPhone(p: string): string {
  return p.startsWith("254") && p.length === 12 ? `0${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}` : p;
}
