"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auditLog, buildings, payments, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { todayEA } from "@/lib/format";
import { runSync } from "@/lib/mpesa/sync";
import { applyPayment } from "@/lib/payments/allocate";
import { markPaidSchema } from "@/lib/validators/payments";
import { toFieldErrors } from "@/lib/validators/auth";
import type { ActionResult } from "@/lib/action-result";

const denied: ActionResult = { ok: false, message: "Your session has expired. Please sign in again." };
const refreshPages = (tenantId?: string) => {
  ["/dashboard", "/payments", "/tenants", "/buildings"].forEach((p) => revalidatePath(p));
  if (tenantId) revalidatePath(`/tenants/${tenantId}`);
};

export type RefreshResult = ActionResult & { inserted: number; skipped: boolean };

/** Dashboard open ("page_open") and the Refresh button ("manual"). */
export async function refreshPayments(trigger: "manual" | "page_open" = "manual"): Promise<RefreshResult> {
  if (!(await getSession())) return { ...denied, inserted: 0, skipped: true };
  const r = await runSync(trigger);
  if (r.inserted > 0) refreshPages();
  return { ok: r.ok, message: r.message, inserted: r.inserted, skipped: r.skipped };
}

/** Manually link an unmatched payment to a tenant. The tenant must pay to the same paybill/till as the payment. */
export async function assignPayment(paymentId: string, tenantId: string): Promise<ActionResult> {
  if (!(await getSession())) return denied;
  if (!paymentId || !tenantId) return { ok: false, message: "Choose a tenant first." };
  try {
    const db = getDb();
    const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    const [row] = await db.select({ sc: buildings.shortcodeId }).from(tenants).innerJoin(buildings, eq(tenants.buildingId, buildings.id)).where(eq(tenants.id, tenantId)).limit(1);
    if (!pay || !row) return { ok: false, message: "That payment or tenant no longer exists." };
    if (pay.shortcodeId && row.sc && pay.shortcodeId !== row.sc) return { ok: false, message: "That tenant pays to a different paybill or till than this payment." };
    const r = await applyPayment(paymentId, tenantId);
    if (r === "already") return { ok: false, message: "That payment is already assigned." };
    if (r === "missing") return { ok: false, message: "That payment or tenant no longer exists." };
    refreshPages(tenantId);
    return { ok: true, message: "Payment assigned." };
  } catch (e) {
    console.error("[payments] assign", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Hide an unmatched payment that isn't rent (a test, a refund, a mistake). */
export async function ignorePayment(paymentId: string): Promise<ActionResult> {
  if (!(await getSession())) return denied;
  try {
    await getDb().update(payments).set({ status: "ignored" }).where(and(eq(payments.id, paymentId), eq(payments.status, "unmatched")));
    refreshPages();
    return { ok: true, message: "Payment ignored." };
  } catch (e) {
    console.error("[payments] ignore", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/**
 * Records rent received outside the automatic flow (typically a TILL payment, or cash) and applies it to the tenant's
 * oldest unpaid month first. If you enter the M-Pesa code and that payment already arrived, use Assign on the Payments page instead.
 */
export async function markTenantPaid(tenantId: string, input: unknown): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  const v = parsed.data;
  if (v.paidOn > todayEA()) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: { paidOn: "The date can’t be in the future." } };
  try {
    const db = getDb();
    const [row] = await db.select({ t: tenants, sc: buildings.shortcodeId }).from(tenants).innerJoin(buildings, eq(tenants.buildingId, buildings.id)).where(eq(tenants.id, tenantId)).limit(1);
    if (!row) return { ok: false, message: "That tenant no longer exists." };
    if (row.t.status !== "active") return { ok: false, message: "That tenant has moved out." };

    const receipt = v.reference ?? `MAN-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    const [clash] = await db.select({ id: payments.id, status: payments.status }).from(payments).where(eq(payments.mpesaReceipt, receipt)).limit(1);
    if (clash) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: { reference: "A payment with this code already exists. Assign it from the Payments page instead." } };

    const [pay] = await db.insert(payments).values({
      mpesaReceipt: receipt, amount: v.amount, billRef: row.t.accountRef, payerName: row.t.name, shortcodeId: row.sc ?? null,
      paidAt: new Date(`${v.paidOn}T12:00:00+03:00`), source: "manual",
      raw: JSON.stringify({ manual: true, note: v.note ?? null, by: me.adminId }),
    }).returning({ id: payments.id });
    const r = await applyPayment(pay.id, tenantId);
    if (r !== "matched") {
      await db.delete(payments).where(eq(payments.id, pay.id));
      return { ok: false, message: "Couldn’t apply that payment. Nothing was saved." };
    }
    await db.insert(auditLog).values({ adminId: me.adminId, action: "payment.manual", entity: "tenant", entityId: tenantId, meta: JSON.stringify({ paymentId: pay.id, amount: v.amount }) });
    refreshPages(tenantId);
    return { ok: true, message: `KES ${v.amount.toLocaleString("en-KE")} recorded for ${row.t.name}.` };
  } catch (e) {
    console.error("[payments] mark paid", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
