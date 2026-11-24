import { NextResponse } from "next/server";
import { newBudget } from "@/lib/payments/allocate";
import type { PullTransaction } from "@/lib/mpesa/client";
import { findShortcodeByNumber } from "@/lib/mpesa/shortcodes";
import { processPullItems } from "@/lib/mpesa/sync";

export const dynamic = "force-dynamic";

/**
 * TEST ONLY. Feeds Pull-shaped transactions through the exact code the real sync uses, so batching, till matching and the
 * full-phone-number check can be tested without Daraja. Disabled (404) unless ENABLE_TEST_ROUTES=1 AND the CRON_SECRET
 * bearer token is sent. Remove the variable when you finish testing.
 *
 * POST { "shortCode": "600222", "items": [ { "transactionId": "...", "trxDate": "2026-11-21T10:00:00Z", "msisdn": "712345126",
 *        "amount": "8000", "billreference": "" } ] }
 */
export async function POST(req: Request) {
  if (process.env.ENABLE_TEST_ROUTES !== "1") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { shortCode?: string; items?: PullTransaction[]; budget?: number } | null;
  if (!body?.shortCode || !Array.isArray(body.items)) return NextResponse.json({ error: "Send { shortCode, items: [...] }" }, { status: 400 });
  const sc = await findShortcodeByNumber(body.shortCode);
  if (!sc) return NextResponse.json({ error: "Unknown shortcode" }, { status: 404 });
  const started = Date.now();
  const r = await processPullItems(sc, body.items, newBudget(body.budget ?? 20));
  return NextResponse.json({ ...r, shortcode: sc.number, matchMode: sc.matchMode, ms: Date.now() - started });
}
