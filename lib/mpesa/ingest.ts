import { eq } from "drizzle-orm";
import { payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { matchPayment } from "@/lib/payments/allocate";
import type { PullTransaction } from "./client";

export type IncomingPayment = {
  receipt: string; amount: number; billRef: string | null; msisdn: string | null;
  payerName: string | null; paidAt: Date; source: "c2b" | "reconcile"; raw: unknown;
};

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");

/** "20231121121325" is Nairobi time (confirmed by Safaricom: all webhook timestamps are EAT). */
function parseTransTime(s: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 3, +m[5], +m[6])) : new Date();
}
/** Safaricom sends every timestamp in Nairobi time, even when a Pull date ends in "Z", so a bare "Z" or no offset means +03:00. */
function parseIso(s: string): Date {
  const d = new Date(/[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(/[zZ]$/, "")}+03:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Webhook payload (Confirmation URL). Returns null when it has no usable receipt or amount. */
export function fromC2B(p: Record<string, unknown>): IncomingPayment | null {
  const receipt = str(p.TransID);
  const amount = Math.round(Number(p.TransAmount));
  if (!receipt || !Number.isFinite(amount) || amount <= 0) return null;
  const name = [p.FirstName, p.MiddleName, p.LastName].map(str).filter(Boolean).join(" ");
  return { receipt, amount, billRef: str(p.BillRefNumber) || null, msisdn: str(p.MSISDN) || null, payerName: name || null,
    paidAt: parseTransTime(str(p.TransTime)), source: "c2b", raw: p };
}

/** Pull API item. It has no payer name, and msisdn is just an opaque string. */
export function fromPull(t: PullTransaction): IncomingPayment | null {
  const receipt = str(t.transactionId);
  const amount = Math.round(Number(t.amount));
  if (!receipt || !Number.isFinite(amount) || amount <= 0) return null;
  return { receipt, amount, billRef: str(t.billreference) || null, msisdn: str(t.msisdn) || null, payerName: null,
    paidAt: parseIso(str(t.trxDate)), source: "reconcile", raw: t };
}

/** Stores a payment once (the M-Pesa receipt is unique) and tries to match it to a tenant. */
export async function ingestPayment(inc: IncomingPayment): Promise<{ inserted: boolean }> {
  const db = getDb();
  const [existing] = await db.select().from(payments).where(eq(payments.mpesaReceipt, inc.receipt)).limit(1);
  if (existing) {
    // Pull may have stored it first; the webhook is the only source of the payer's name.
    if (!existing.payerName && inc.payerName) await db.update(payments).set({ payerName: inc.payerName }).where(eq(payments.id, existing.id));
    return { inserted: false };
  }
  const [row] = await db.insert(payments).values({
    mpesaReceipt: inc.receipt, amount: inc.amount, billRef: inc.billRef, msisdnHash: inc.msisdn, payerName: inc.payerName,
    paidAt: inc.paidAt, source: inc.source, raw: JSON.stringify(inc.raw),
  }).onConflictDoNothing().returning({ id: payments.id });
  if (!row) return { inserted: false };
  await matchPayment(row.id, inc.billRef);
  return { inserted: true };
}
