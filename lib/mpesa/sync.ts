import { desc, eq, inArray } from "drizzle-orm";
import { syncRuns } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { rematchUnmatched } from "@/lib/payments/allocate";
import { pullTransactions } from "./client";
import { isConfigured } from "./config";
import { fromPull, ingestPayment } from "./ingest";

export type SyncTrigger = "cron" | "manual" | "page_open";
export type SyncResult = { ok: boolean; skipped: boolean; message: string; fetched: number; inserted: number };
const result = (ok: boolean, skipped: boolean, message: string, fetched = 0, inserted = 0): SyncResult => ({ ok, skipped, message, fetched, inserted });

/** Pulls the last 47 hours from Safaricom and stores anything new. Page opens and the Refresh button respect the cooldown setting. */
export async function runSync(trigger: SyncTrigger): Promise<SyncResult> {
  if (!isConfigured()) return result(false, true, "M-Pesa isn’t configured yet. Add your Daraja keys to the environment.");
  const db = getDb();

  if (trigger !== "cron") {
    const cooldown = Number((await getSettings()).sync_cooldown_seconds) || 60;
    const [last] = await db.select().from(syncRuns).where(inArray(syncRuns.status, ["ok", "running"])).orderBy(desc(syncRuns.startedAt)).limit(1);
    const age = last ? Math.floor((Date.now() - last.startedAt.getTime()) / 1000) : Infinity;
    if (age < cooldown) return result(true, true, `Already up to date (synced ${age}s ago).`);
  }

  const [run] = await db.insert(syncRuns).values({ trigger }).returning({ id: syncRuns.id });
  try {
    const items = await pullTransactions();
    let inserted = 0;
    for (const item of items) {
      const inc = fromPull(item);
      if (inc && (await ingestPayment(inc)).inserted) inserted++;
    }
    await rematchUnmatched();
    await db.update(syncRuns).set({ status: "ok", fetched: items.length, inserted, finishedAt: new Date() }).where(eq(syncRuns.id, run.id));
    return result(true, false, inserted ? `${inserted} new payment${inserted === 1 ? "" : "s"} found.` : "No new payments.", items.length, inserted);
  } catch (e) {
    console.error("[sync]", e);
    await db.update(syncRuns).set({ status: "failed", error: (e instanceof Error ? e.message : "Sync failed").slice(0, 500), finishedAt: new Date() }).where(eq(syncRuns.id, run.id));
    return result(false, false, "Couldn’t reach M-Pesa. Try again in a minute.");
  }
}

/** When the last successful sync finished, or null. */
export async function getLastSync(): Promise<Date | null> {
  const [r] = await getDb().select().from(syncRuns).where(eq(syncRuns.status, "ok")).orderBy(desc(syncRuns.startedAt)).limit(1);
  return r?.finishedAt ?? null;
}
