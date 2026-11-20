import { desc, eq, inArray } from "drizzle-orm";
import { shortcodes, syncRuns } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { rematchUnmatched } from "@/lib/payments/allocate";
import { pullTransactions } from "./client";
import { fromPull, ingestPayment } from "./ingest";
import { credsFor, hasKeys, listShortcodes } from "./shortcodes";

export type SyncTrigger = "cron" | "manual" | "page_open";
export type SyncResult = { ok: boolean; skipped: boolean; message: string; fetched: number; inserted: number };
const result = (ok: boolean, skipped: boolean, message: string, fetched = 0, inserted = 0): SyncResult => ({ ok, skipped, message, fetched, inserted });

/**
 * Pulls the last 47 hours from Safaricom for EVERY active shortcode that has Daraja keys, and stores anything new.
 * One shortcode failing never stops the others. Page opens and the Refresh button respect the cooldown setting.
 */
export async function runSync(trigger: SyncTrigger): Promise<SyncResult> {
  const targets = (await listShortcodes({ activeOnly: true })).filter(hasKeys);
  if (!targets.length) return result(false, true, "No active paybill or till has Daraja keys yet. Add them under Paybills & Tills.");
  const db = getDb();

  if (trigger !== "cron") {
    const cooldown = Number((await getSettings()).sync_cooldown_seconds) || 60;
    const [last] = await db.select().from(syncRuns).where(inArray(syncRuns.status, ["ok", "running"])).orderBy(desc(syncRuns.startedAt)).limit(1);
    const age = last ? Math.floor((Date.now() - last.startedAt.getTime()) / 1000) : Infinity;
    if (age < cooldown) return result(true, true, `Already up to date (synced ${age}s ago).`);
  }

  const [run] = await db.insert(syncRuns).values({ trigger }).returning({ id: syncRuns.id });
  let fetched = 0;
  let inserted = 0;
  const failed: string[] = [];
  for (const sc of targets) {
    try {
      const items = await pullTransactions(await credsFor(sc));
      fetched += items.length;
      for (const item of items) {
        const inc = fromPull(item, sc.number);
        if (inc && (await ingestPayment(inc, sc)).inserted) inserted++;
      }
      await db.update(shortcodes).set({ lastSyncAt: new Date(), lastSyncError: null }).where(eq(shortcodes.id, sc.id));
    } catch (e) {
      console.error("[sync]", sc.label, e);
      failed.push(sc.label);
      await db.update(shortcodes).set({ lastSyncError: (e instanceof Error ? e.message : "Sync failed").slice(0, 300) }).where(eq(shortcodes.id, sc.id));
    }
  }
  try { await rematchUnmatched(); } catch (e) { console.error("[sync] rematch", e); }

  const allFailed = failed.length === targets.length;
  await db.update(syncRuns).set({
    status: allFailed ? "failed" : "ok", fetched, inserted, error: failed.length ? `Failed: ${failed.join(", ")}`.slice(0, 500) : null, finishedAt: new Date(),
  }).where(eq(syncRuns.id, run.id));

  if (allFailed) return result(false, false, "Couldn’t reach M-Pesa. Check each shortcode’s keys, then try again in a minute.");
  const found = inserted ? `${inserted} new payment${inserted === 1 ? "" : "s"} found.` : "No new payments.";
  return result(true, false, failed.length ? `${found} Couldn’t sync: ${failed.join(", ")}.` : found, fetched, inserted);
}

/** When the last successful sync finished, or null. */
export async function getLastSync(): Promise<Date | null> {
  const [r] = await getDb().select().from(syncRuns).where(eq(syncRuns.status, "ok")).orderBy(desc(syncRuns.startedAt)).limit(1);
  return r?.finishedAt ?? null;
}
