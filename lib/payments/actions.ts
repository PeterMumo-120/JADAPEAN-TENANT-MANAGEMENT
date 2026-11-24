"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { auditLog, buildings, payerAliases, payments, shortcodes, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { todayEA } from "@/lib/format";
import { runSync } from "@/lib/mpesa/sync";
import { applyLoaded, applyPayment, releasePayment } from "@/lib/payments/allocate";
import { blockPayer, fingerprintOf, learnPayer } from "@/lib/payments/payer";
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

/**
 * After the owner confirms who a till payer is, other waiting payments from the SAME payer (same name and phone digits)
 * are assigned to that tenant too. Skipped when the till's matching is Off. Returns how many were assigned.
 */
async function assignSamePayer(shortcodeId: string, tenantId: string, fingerprint: string): Promise<number> {
  const db = getDb();
  const [sc] = await db.select({ mode: shortcodes.matchMode }).from(shortcodes).where(eq(shortcodes.id, shortcodeId)).limit(1);
  if (!sc || sc.mode === "off") return 0;
  const waiting = await db.select().from(payments).where(and(eq(payments.shortcodeId, shortcodeId), eq(payments.status, "unmatched"))).limit(100);
  const same = waiting.filter((p) => fingerprintOf(p.payerName, p.msisdnHash) === fingerprint && !p.matchReason?.split(":")[1]?.split(",").includes(tenantId)).slice(0, 10);
  let n = 0;
  for (const p of same) {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!t) break;
    if (await applyLoaded(p, t, { method: "learned", reason: "same payer as one you assigned" })) n++;
  }
  return n;
}

/** Manually link an unmatched payment to a tenant. The tenant must pay to the same paybill/till as the payment. */
export async function assignPayment(paymentId: string, tenantId: string): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  if (!paymentId || !tenantId) return { ok: false, message: "Choose a tenant first." };
  try {
    const db = getDb();
    const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    const [row] = await db.select({ sc: buildings.shortcodeId }).from(tenants).innerJoin(buildings, eq(tenants.buildingId, buildings.id)).where(eq(tenants.id, tenantId)).limit(1);
    if (!pay || !row) return { ok: false, message: "That payment or tenant no longer exists." };
    if (pay.shortcodeId && row.sc && pay.shortcodeId !== row.sc) return { ok: false, message: "That tenant pays to a different paybill or till than this payment." };
    const r = await applyPayment(paymentId, tenantId, { method: "manual", reason: "assigned by you" });
    if (r === "already") return { ok: false, message: "That payment is already assigned." };
    if (r === "missing") return { ok: false, message: "That payment or tenant no longer exists." };

    // Teach the app who this payer is (tills only), then assign their other waiting payments.
    let extra = "";
    if (pay.shortcodeId) {
      const [sc] = await db.select({ type: shortcodes.type }).from(shortcodes).where(eq(shortcodes.id, pay.shortcodeId)).limit(1);
      if (sc?.type === "till") {
        const fp = await learnPayer({ shortcodeId: pay.shortcodeId, tenantId, payerName: pay.payerName, msisdn: pay.msisdnHash });
        const more = fp ? await assignSamePayer(pay.shortcodeId, tenantId, fp) : 0;
        if (more > 0) extra = ` ${more} more payment${more === 1 ? "" : "s"} from the same payer ${more === 1 ? "was" : "were"} assigned too.`;
      }
    }
    await db.insert(auditLog).values({ adminId: me.adminId, action: "payment.assign", entity: "payment", entityId: paymentId, meta: JSON.stringify({ tenantId }) });
    refreshPages(tenantId);
    return { ok: true, message: `Payment assigned.${extra}` };
  } catch (e) {
    console.error("[payments] assign", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

const AUTO = ["learned", "scored", "phone"] as const;

/** "Looks right": keeps an automatic till match and teaches the app this payer. */
export async function confirmMatch(paymentId: string): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  try {
    const db = getDb();
    const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!pay || pay.status !== "matched" || !pay.tenantId || !AUTO.includes(pay.matchMethod as (typeof AUTO)[number])) return { ok: false, message: "There is nothing to confirm on this payment." };
    if (pay.shortcodeId) await learnPayer({ shortcodeId: pay.shortcodeId, tenantId: pay.tenantId, payerName: pay.payerName, msisdn: pay.msisdnHash });
    await db.update(payments).set({ matchMethod: "manual", matchReason: "confirmed by you" }).where(eq(payments.id, paymentId));
    await db.insert(auditLog).values({ adminId: me.adminId, action: "payment.confirm", entity: "payment", entityId: paymentId });
    refreshPages(pay.tenantId);
    return { ok: true, message: "Confirmed. Future payments from this payer will go to the same tenant." };
  } catch (e) {
    console.error("[payments] confirm", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Takes an automatic match back: the payment returns to the inbox and this payer is never matched to that tenant again. */
export async function undoMatch(paymentId: string): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  try {
    const db = getDb();
    const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!pay || pay.status !== "matched" || !pay.tenantId || !AUTO.includes(pay.matchMethod as (typeof AUTO)[number])) return { ok: false, message: "Only automatic matches can be undone here." };
    const tenantId = pay.tenantId;
    const [t] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (pay.shortcodeId) await blockPayer({ shortcodeId: pay.shortcodeId, tenantId, payerName: pay.payerName, msisdn: pay.msisdnHash });
    await releasePayment(paymentId);
    await db.insert(auditLog).values({ adminId: me.adminId, action: "payment.undo_match", entity: "payment", entityId: paymentId, meta: JSON.stringify({ tenantId }) });
    refreshPages(tenantId);
    return { ok: true, message: `Moved back to the inbox. This payer won’t be matched to ${t?.name ?? "that tenant"} again.` };
  } catch (e) {
    console.error("[payments] undo", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Removes something the app learned (or an Undo block) about a payer, from the tenant's page. */
export async function forgetPayer(aliasId: string): Promise<ActionResult> {
  if (!(await getSession())) return denied;
  try {
    const db = getDb();
    const [a] = await db.select().from(payerAliases).where(eq(payerAliases.id, aliasId)).limit(1);
    if (!a) return { ok: false, message: "That payer no longer exists." };
    await db.delete(payerAliases).where(inArray(payerAliases.id, [aliasId]));
    revalidatePath(`/tenants/${a.tenantId}`);
    return { ok: true, message: "Forgotten. The app will treat this payer as new." };
  } catch (e) {
    console.error("[payments] forget", e);
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
