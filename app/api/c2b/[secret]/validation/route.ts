import { NextResponse } from "next/server";
import { webhookAllowed } from "@/lib/mpesa/config";

export const dynamic = "force-dynamic";

/** Required by the API but External Validation is off, so M-Pesa never really waits on this. Always accepts. */
export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  if (!webhookAllowed(req, secret).ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ResultCode: "0", ResultDesc: "Accepted" });
}
