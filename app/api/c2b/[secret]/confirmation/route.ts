import { NextResponse } from "next/server";
import { ipAllowed, secretOk } from "@/lib/mpesa/config";
import { fromC2B, ingestPayment } from "@/lib/mpesa/ingest";
import { findShortcodeByNumber } from "@/lib/mpesa/shortcodes";

export const dynamic = "force-dynamic";

/**
 * Safaricom calls this after a payment completes, for ANY of your paybills/tills (the payload carries BusinessShortCode).
 * Safaricom never retries, so once the caller is authorised we always answer "accepted"; anything we failed to store is
 * recovered by the Pull sync.
 */
export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  if (!secretOk(secret)) {
    console.warn("[c2b] rejected: bad secret");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const inc = fromC2B(body);
    const sc = inc?.shortCode ? await findShortcodeByNumber(inc.shortCode) : null;
    if (!ipAllowed(req, sc)) {
      console.warn("[c2b] rejected: caller is not a Safaricom IP for", inc?.shortCode ?? "unknown shortcode");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (inc) await ingestPayment(inc, sc);
    else console.warn("[c2b] ignored a payload without a valid TransID/TransAmount");
  } catch (e) {
    console.error("[c2b] could not store payment", e);
  }
  return NextResponse.json({ ResultCode: "0", ResultDesc: "Accepted" });
}
