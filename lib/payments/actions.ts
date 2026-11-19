"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { runSync } from "@/lib/mpesa/sync";
import { applyPayment } from "@/lib/payments/allocate";
import type { ActionResult } from "@/lib/action-result";

const denied: ActionResult = { ok: false, message: "Your session has expired. Please sign in again." };
const refreshPages = () => ["/dashboard", "/payments", "/tenants", "/buildings"].forEach((p) => revalidatePath(p));

export type RefreshResult = ActionResult & { inserted: number; skipped: boolean };

/** Dashboard open ("page_open") and the Refresh button ("manual"). */
export async function refreshPayments(trigger: "manual" | "page_open" = "manual"): Promise<RefreshResult> {
  if (!(await getSession())) return { ...denied, inserted: 0, skipped: true };
  const r = await runSync(trigger);
  if (r.inserted > 0) refreshPages();
  return { ok: r.ok, message: r.message, inserted: r.inserted, skipped: r.skipped };
}

/** Manually link an unmatched payment to a tenant. */
export async function assignPayment(paymentId: string, tenantId: string): Promise<ActionResult> {
  if (!(await getSession())) return denied;
  if (!paymentId || !tenantId) return { ok: false, message: "Choose a tenant first." };
  try {
    const r = await applyPayment(paymentId, tenantId);
    if (r === "already") return { ok: false, message: "That payment is already assigned." };
    if (r === "missing") return { ok: false, message: "That payment or tenant no longer exists." };
    refreshPages();
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
