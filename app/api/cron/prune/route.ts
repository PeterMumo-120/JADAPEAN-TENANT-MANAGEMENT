import { NextResponse } from "next/server";
import { pruneOldRows, RETENTION_DAYS } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/**
 * Runs the housekeeping on demand: `curl -X POST "$APP_URL/api/cron/prune?force=1" -H "Authorization: Bearer $CRON_SECRET"`.
 * Without ?force=1 it respects the once-a-day gate.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  const r = await pruneOldRows({ force });
  return NextResponse.json({ ...r, retentionDays: RETENTION_DAYS });
}
