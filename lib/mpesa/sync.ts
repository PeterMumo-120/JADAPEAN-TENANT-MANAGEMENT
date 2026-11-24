import { desc, eq, inArray } from "drizzle-orm";
import { shortcodes, syncRuns } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { newBudget, rematchUnmatched, type Budget } from "@/lib/payments/allocate";
import { pullTransactions, type PullTransaction } from "./client";
import { fromPull, ingestMany, type IngestResult } from "./ingest";
import { credsFor, hasKeys, listShortcodes, type Shortcode } from "./shortcodes";

export type SyncTrigger = "cron" | "manual" | "page_open";
export type SyncResult = { ok: boolean; skipped: boolean; message: string; fetched: number; inserted: number; matched: number; deferred: number };
const result = (ok: boolean, skipped: boolean, message: string, extra: Partial<SyncResult> = {}): SyncResult =>
  ({ ok, skipped, message, fetched: 0, inserted: 0, matched: 0, deferred: 0, ...extra });

/** Stores Pull-shaped transactions for one shortcode. Shared by the real sync and the test route. */
export async function processPullItems(sc: Shortcode, items: PullTransaction[], budget: Budget): Promise<IngestResult & { fetched: number }> {
  const incs = items.map((i) => fromPull(i, sc.number)).filter((x): x is NonNullable<typeof x> => !!x);
  return { fetched: items.length, ...(await ingestMany(sc, incs, budget)) };
}

/**
 * Pulls the last 47 hours from Safaricom for EVERY active shortcode that has Daraja keys, and stores anything new.
 * One shortcode failing never stops the others. Page opens and the Refresh button respect the cooldown setting.
 *
 * Free-plan friendly: each shortcode costs a handful of database calls (see ingestMany), and a shared budget caps how
 * many payments are assigned in one run. Leftovers are retried by the next run.
 */
export async function runSync(trigger: SyncTrigger): Promise<SyncResult> {
  const targets = (await listShortcodes({ activeOnly: true })).filter(hasKeys);
  if (!targets.length) return result(false, true, "Automatic payment checking isn’t set up yet. Ask your administrator to finish the set-up under Settings → Payment numbers.");
  const db = getDb();

  if (trigger !== "cron") {
    const cooldown = Number((await getSettings()).sync_cooldown_seconds) || 60;
    const [last] = await db.select().from(syncRuns).where(inArray(syncRuns.status, ["ok", "running"])).orderBy(desc(syncRuns.startedAt)).limit(1);
    const age = last ? Math.floor((Date.now() - last.startedAt.getTime()) / 1000) : Infinity;
    if (age < cooldown) return result(true, true, `Already up to date (synced ${age}s ago).`);
  }

  const [run] = await db.insert(syncRuns).values({ trigger }).returning({ id: syncRuns.id });
  const budget = newBudget(20);
  let fetched = 0, inserted = 0, matched = 0, deferred = 0;
  const failed: string[] = [];
  for (const sc of targets) {
    try {
      const r = await processPullItems(sc, await pullTransactions(await credsFor(sc)), budget);
      fetched += r.fetched; inserted += r.inserted; matched += r.matched; deferred += r.deferred;
      await db.update(shortcodes).set({ lastSyncAt: new Date(), lastSyncError: null }).where(eq(shortcodes.id, sc.id));
    } catch (e) {
      console.error("[sync]", sc.label, e);
      failed.push(sc.label);
      await db.update(shortcodes).set({ lastSyncError: (e instanceof Error ? e.message : "Sync failed").slice(0, 300) }).where(eq(shortcodes.id, sc.id));
    }
  }
  try { matched += await rematchUnmatched({ left: Math.max(budget.left, 5) }); } catch (e) { console.error("[sync] rematch", e); }

  const allFailed = failed.length === targets.length;
  await db.update(syncRuns).set({
    status: allFailed ? "failed" : "ok", fetched, inserted, error: failed.length ? `Failed: ${failed.join(", ")}`.slice(0, 500) : null, finishedAt: new Date(),
  }).where(eq(syncRuns.id, run.id));
  console.log(`[sync] shortcodes=${targets.length} fetched=${fetched} inserted=${inserted} matched=${matched} deferred=${deferred} failed=${failed.length}`);

  const extra = { fetched, inserted, matched, deferred };
  if (allFailed) return result(false, false, "Couldn’t reach M-Pesa just now. Please try again in a minute. If it keeps happening, ask your administrator to check Settings → Payment numbers.", extra);
  const found = inserted ? `${inserted} new payment${inserted === 1 ? "" : "s"} found${matched ? `, ${matched} assigned` : ""}.` : matched ? `${matched} payment${matched === 1 ? "" : "s"} assigned.` : "No new payments.";
  return result(true, false, failed.length ? `${found} Couldn’t sync: ${failed.join(", ")}.` : found, extra);
}

/** When the last successful sync finished, or null. */
export async function getLastSync(): Promise<Date | null> {
  const [r] = await getDb().select().from(syncRuns).where(eq(syncRuns.status, "ok")).orderBy(desc(syncRuns.startedAt)).limit(1);
  return r?.finishedAt ?? null;
}
