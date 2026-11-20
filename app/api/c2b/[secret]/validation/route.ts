import { NextResponse } from "next/server";
import { ipAllowed, secretOk } from "@/lib/mpesa/config";
import { findShortcodeByNumber } from "@/lib/mpesa/shortcodes";

export const dynamic = "force-dynamic";

/** Required by the API but External Validation is off, so M-Pesa never really waits on this. Always accepts. */
export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  if (!secretOk(secret)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let number = "";
  try {
    const body = (await req.json()) as Record<string, unknown>;
    number = typeof body.BusinessShortCode === "string" || typeof body.BusinessShortCode === "number" ? String(body.BusinessShortCode) : "";
  } catch { /* an empty or odd body is still accepted below, after the IP check */ }
  const sc = number ? await findShortcodeByNumber(number) : null;
  if (!ipAllowed(req, sc)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ResultCode: "0", ResultDesc: "Accepted" });
}
