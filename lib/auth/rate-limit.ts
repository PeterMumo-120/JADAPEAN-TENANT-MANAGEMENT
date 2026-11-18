import { and, count, eq, gt, lt } from "drizzle-orm";
import { loginAttempts } from "@/db/schema";
import { getDb } from "@/lib/db";

/** Limits, per window. Tune freely. */
export const LIMITS = {
  loginPerIp: { max: 15, windowSeconds: 600 }, // failed logins from one IP
  loginPerPhone: { max: 5, windowSeconds: 900 }, // failed logins for one phone number
  registerPerIp: { max: 5, windowSeconds: 3600 }, // registration attempts from one IP
} as const;

export function clientIp(h: Headers): string {
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function recentAttempts(key: string, windowSeconds: number, failuresOnly = true): Promise<number> {
  const since = new Date(Date.now() - windowSeconds * 1000);
  const conditions = [eq(loginAttempts.key, key), gt(loginAttempts.createdAt, since)];
  if (failuresOnly) conditions.push(eq(loginAttempts.success, false));
  const [row] = await getDb().select({ n: count() }).from(loginAttempts).where(and(...conditions));
  return row?.n ?? 0;
}

export async function recordAttempt(key: string, success: boolean) {
  await getDb().insert(loginAttempts).values({ key, success });
}

export async function clearFailures(key: string) {
  await getDb().delete(loginAttempts).where(and(eq(loginAttempts.key, key), eq(loginAttempts.success, false)));
}

/** Call from the daily cron to keep the table small. */
export async function pruneAttempts(olderThanSeconds = 30 * 86_400) {
  await getDb().delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - olderThanSeconds * 1000)));
}
