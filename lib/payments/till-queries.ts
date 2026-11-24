import { and, count, desc, eq, gte, inArray, ne, sum } from "drizzle-orm";
import { buildings, payerAliases, payments, shortcodes, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { currentPeriod } from "@/lib/tenants/status";
import { buildTillContext, decide, type MatchMode } from "./till-match";

export type TillSuggestion = { tenantId: string; label: string; reasons: string[]; score: number };
export type TillInboxItem = {
  id: string; amount: number; payer: string; receipt: string; time: string;
  suggestion: TillSuggestion | null; ambiguousPayer: boolean;
};
export type TillGroup = {
  shortcodeId: string; label: string; number: string; mode: MatchMode;
  items: TillInboxItem[]; tenants: { id: string; label: string }[];
};

const SUGGEST_MIN = 30; // lowest score worth pre-selecting

/**
 * Unassigned till payments, grouped by till, each with the matcher's best guess. A fixed number of queries
 * (payments, tenants, payer memory) whatever the size of the inbox.
 */
export async function getTillInbox(): Promise<TillGroup[]> {
  const db = getDb();
  const rows = await db.select({ p: payments, sc: shortcodes }).from(payments).innerJoin(shortcodes, eq(payments.shortcodeId, shortcodes.id))
    .where(and(eq(payments.status, "unmatched"), eq(shortcodes.type, "till"))).orderBy(desc(payments.paidAt)).limit(200);
  if (!rows.length) return [];

  const ids = [...new Set(rows.map((r) => r.sc.id))];
  const [tenantRows, aliasRows] = await Promise.all([
    db.select({ t: tenants, buildingName: buildings.name, scId: buildings.shortcodeId }).from(tenants).innerJoin(buildings, eq(tenants.buildingId, buildings.id))
      .where(and(eq(tenants.status, "active"), inArray(buildings.shortcodeId, ids))).orderBy(buildings.name, tenants.houseNo),
    db.select().from(payerAliases).where(inArray(payerAliases.shortcodeId, ids)),
  ]);

  const groups: TillGroup[] = [];
  for (const id of ids) {
    const sc = rows.find((r) => r.sc.id === id)!.sc;
    const ctx = buildTillContext(id, sc.matchMode, tenantRows.filter((t) => t.scId === id), aliasRows.filter((a) => a.shortcodeId === id));
    const label = (t: (typeof ctx.tenants)[number]) => `${t.name} · ${t.buildingName}${t.houseNo ? ` ${t.houseNo}` : ""}`;
    const items: (TillInboxItem & { building: string })[] = rows.filter((r) => r.sc.id === id).map(({ p }) => {
      const d = decide(ctx, { amount: p.amount, payerName: p.payerName, msisdn: p.msisdnHash, excludeTenantIds: p.matchReason?.startsWith("undone:") ? p.matchReason.slice(7).split(",") : [] });
      const top = d.candidates[0];
      const t = top && top.score >= SUGGEST_MIN ? ctx.tenants.find((x) => x.id === top.tenantId) : undefined;
      return {
        id: p.id, amount: p.amount, payer: p.payerName ?? "Unknown payer", receipt: p.mpesaReceipt, time: formatWhen(p.paidAt), ambiguousPayer: d.ambiguousPayer,
        suggestion: t && top ? { tenantId: t.id, label: label(t), reasons: top.reasons, score: top.score } : null, building: t?.buildingName ?? "~",
      };
    });
    items.sort((a, b) => a.building.localeCompare(b.building));
    groups.push({
      shortcodeId: id, label: sc.label, number: sc.number, mode: sc.matchMode,
      items: items.map(({ building, ...rest }) => { void building; return rest; }),
      tenants: ctx.tenants.map((t) => ({ id: t.id, label: label(t) })),
    });
  }
  return groups;
}

export type TillTotals = { shortcodeId: string; label: string; number: string; received: number; assigned: number; unassigned: number; count: number };

/** This month's money per till: what arrived, what is assigned to tenants, and what still needs assigning. */
export async function getTillTotals(): Promise<TillTotals[]> {
  const db = getDb();
  const since = new Date(`${currentPeriod()}-01T00:00:00+03:00`);
  const [tills, pays] = await Promise.all([
    db.select().from(shortcodes).where(eq(shortcodes.type, "till")),
    db.select({ sc: payments.shortcodeId, status: payments.status, amount: payments.amount }).from(payments)
      .where(and(gte(payments.paidAt, since), ne(payments.status, "ignored"))),
  ]);
  return tills.map((t) => {
    const mine = pays.filter((p) => p.sc === t.id);
    const assigned = mine.filter((p) => p.status === "matched").reduce((a, p) => a + p.amount, 0);
    const unassigned = mine.filter((p) => p.status === "unmatched").reduce((a, p) => a + p.amount, 0);
    return { shortcodeId: t.id, label: t.label, number: t.number, received: assigned + unassigned, assigned, unassigned, count: mine.length };
  });
}

/** For the dashboard: till payments still waiting to be assigned. */
export async function getTillUnassigned(): Promise<{ count: number; amount: number }> {
  const [r] = await getDb().select({ n: count(), total: sum(payments.amount) }).from(payments).innerJoin(shortcodes, eq(payments.shortcodeId, shortcodes.id))
    .where(and(eq(payments.status, "unmatched"), eq(shortcodes.type, "till")));
  return { count: r?.n ?? 0, amount: Number(r?.total ?? 0) };
}
