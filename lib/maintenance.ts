import { eq, inArray, lt } from "drizzle-orm";
import { auditLog, loginAttempts, sessions, settings, syncRuns } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * Housekeeping for the free plan: keeps the log-style tables small so the 5 GB limit and the daily row-read limit are
 * never a worry. Business data (tenants, payments, allocations, buildings) is never touched.
 */
export const RETENTION_DAYS = { sync_runs: 30, login_attempts: 30, expired_sessions: 7, audit_log: 365 } as const;

const DAY = 86_400_000;
const BATCH = 500; // rows deleted per statement
const MAX_PASSES = 4; // safety stop per table per run (the next run continues a big backlog)
const GATE_KEY = "last_prune_at";
const GATE_HOURS = 20;

export type PruneResult = { ran: boolean; reason?: string; deleted: Record<keyof typeof RETENTION_DAYS, number> };
const zero = (): PruneResult["deleted"] => ({ sync_runs: 0, login_attempts: 0, expired_sessions: 0, audit_log: 0 });

/**
 * Deletes old rows, up to BATCH per statement, using a sub-select so no ids are sent back and forth (D1 allows only 100
 * bound parameters per statement). One database call per pass.
 */
async function sweep(table: typeof syncRuns | typeof loginAttempts | typeof sessions | typeof auditLog, column: Parameters<typeof lt>[0], cutoff: Date): Promise<number> {
  const db = getDb();
  let total = 0;
  for (let i = 0; i < MAX_PASSES; i++) {
    const gone = await db.delete(table).where(inArray(table.id, db.select({ id: table.id }).from(table).where(lt(column, cutoff)).limit(BATCH))).returning({ id: table.id });
    total += gone.length;
    if (gone.length < BATCH) break;
  }
  return total;
}

/**
 * Runs at most about once a day (tracked in the settings table) unless `force` is set. Called from the cron route, and
 * from /api/cron/prune for testing.
 */
export async function pruneOldRows(opts: { force?: boolean; now?: Date } = {}): Promise<PruneResult> {
  const db = getDb();
  const now = opts.now ?? new Date();

  if (!opts.force) {
    const [g] = await db.select().from(settings).where(eq(settings.key, GATE_KEY)).limit(1);
    const last = g ? Number(g.value) : 0;
    if (last && now.getTime() - last < GATE_HOURS * 3_600_000) return { ran: false, reason: "Already pruned within the last day.", deleted: zero() };
  }
  // Stamp first, so two overlapping cron runs don't both prune.
  await db.insert(settings).values({ key: GATE_KEY, value: String(now.getTime()) })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(now.getTime()), updatedAt: now } });

  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const deleted = zero();
  deleted.sync_runs = await sweep(syncRuns, syncRuns.startedAt, ago(RETENTION_DAYS.sync_runs));
  deleted.login_attempts = await sweep(loginAttempts, loginAttempts.createdAt, ago(RETENTION_DAYS.login_attempts));
  deleted.expired_sessions = await sweep(sessions, sessions.expiresAt, ago(RETENTION_DAYS.expired_sessions));
  deleted.audit_log = await sweep(auditLog, auditLog.createdAt, ago(RETENTION_DAYS.audit_log));
  return { ran: true, deleted };
}
