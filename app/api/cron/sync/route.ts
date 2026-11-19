import { NextResponse } from "next/server";
import { runSync } from "@/lib/mpesa/sync";

export const dynamic = "force-dynamic";

/** Called by the Worker's cron trigger (worker.ts), or by hand with `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await runSync("cron");
  return NextResponse.json(r, { status: r.ok || r.skipped ? 200 : 502 });
}
