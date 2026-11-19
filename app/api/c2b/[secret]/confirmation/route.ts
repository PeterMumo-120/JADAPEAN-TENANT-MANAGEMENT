import { NextResponse } from "next/server";
import { webhookAllowed } from "@/lib/mpesa/config";
import { fromC2B, ingestPayment } from "@/lib/mpesa/ingest";

export const dynamic = "force-dynamic";

/**
 * Safaricom calls this after a payment completes. Safaricom never retries, so once the caller is
 * authorised we always answer "accepted"; anything we failed to store is recovered by the Pull sync.
 */
export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const gate = webhookAllowed(req, secret);
  if (!gate.ok) {
    console.warn("[c2b] rejected:", gate.reason);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const inc = fromC2B(await req.json());
    if (inc) await ingestPayment(inc);
    else console.warn("[c2b] ignored a payload without a valid TransID/TransAmount");
  } catch (e) {
    console.error("[c2b] could not store payment", e);
  }
  return NextResponse.json({ ResultCode: "0", ResultDesc: "Accepted" });
}
