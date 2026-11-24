import { NextResponse } from "next/server";
import { pruneOldRows } from "@/lib/maintenance";
import { newBudget, rematchUnmatched } from "@/lib/payments/allocate";
import { runSync } from "@/lib/mpesa/sync";

export const dynamic = "force-dynamic";

/**
 * Called by the Worker's cron trigger (worker.ts), or by hand with `Authorization: Bearer <CRON_SECRET>`.
 * Syncs payments, retries leftovers, then does the daily housekeeping (a no-op on most runs).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sync = await runSync("cron");
  // A real sync already re-matches. When it was skipped (e.g. no shortcode has Daraja keys yet) still retry the leftovers.
  const rematched = sync.skipped ? await rematchUnmatched(newBudget(15)).catch((e) => { console.error("[cron] rematch failed", e); return 0; }) : undefined;
  const prune = await pruneOldRows().catch((e) => { console.error("[cron] prune failed", e); return { ran: false, reason: "failed" }; });
  return NextResponse.json({ ...sync, rematched, prune }, { status: sync.ok || sync.skipped ? 200 : 502 });
}
