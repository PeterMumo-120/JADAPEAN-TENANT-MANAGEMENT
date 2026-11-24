"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, isNull, ne, sql } from "drizzle-orm";
import { auditLog, buildings, paymentAllocations, payments, shortcodes, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { normaliseRef } from "@/lib/format";
import { rematchUnmatched } from "@/lib/payments/allocate";
import { tenantSchema, type TenantValues } from "@/lib/validators/tenants";
import { toFieldErrors } from "@/lib/validators/auth";
import type { ActionResult } from "@/lib/action-result";

const denied: ActionResult = { ok: false, message: "Your session has expired. Please sign in again." };
const fixFields = "Please fix the highlighted fields.";

async function audit(adminId: string, action: string, id: string) {
  await getDb().insert(auditLog).values({ adminId, action, entity: "tenant", entityId: id });
}
function refresh(id?: string) {
  ["/tenants", "/buildings", "/dashboard", "/payments"].forEach((p) => revalidatePath(p));
  if (id) revalidatePath(`/tenants/${id}`);
}
function failure(e: unknown): ActionResult {
  console.error("[tenants]", e);
  const unique = e instanceof Error && /UNIQUE/i.test(e.message);
  return { ok: false, message: unique ? "That house is already in use." : "Something went wrong. Please try again." };
}

type Rules = { excludeId?: string; active: boolean; buildingChanged: boolean; creating: boolean };
type Checked = { errors: Record<string, string> | null; accountRef: string | null; isTill: boolean };

/**
 * Business rules the schema can't express. Returns field errors (or null) and the account number to store:
 * required for PAYBILL buildings, always empty for TILL buildings (tills have no account numbers).
 */
async function check(v: TenantValues, o: Rules): Promise<Checked> {
  const db = getDb();
  const errors: Record<string, string> = {};
  const [row] = await db.select({ b: buildings, sc: shortcodes }).from(buildings).leftJoin(shortcodes, eq(buildings.shortcodeId, shortcodes.id)).where(eq(buildings.id, v.buildingId)).limit(1);
  if (!row) return { errors: { buildingId: "That building no longer exists." }, accountRef: null, isTill: false };
  const { b, sc } = row;
  const others = o.excludeId ? ne(tenants.id, o.excludeId) : undefined;

  if (o.buildingChanged && b.archivedAt) errors.buildingId = `${b.name} is archived. Restore it first or pick another building.`;
  if (o.creating && !sc) errors.buildingId = `${b.name} has no paybill or till yet. Open the building and attach one first.`;

  if (o.active) {
    if (o.buildingChanged) {
      const [{ n }] = await db.select({ n: count() }).from(tenants).where(and(eq(tenants.buildingId, b.id), eq(tenants.status, "active"), others));
      if (n >= b.totalUnits) errors.buildingId = `${b.name} is full (${n} of ${b.totalUnits} houses occupied).`;
    }
    if (v.houseNo) {
      const clash = await db.select({ id: tenants.id }).from(tenants)
        .where(and(eq(tenants.buildingId, b.id), eq(tenants.status, "active"), sql`lower(${tenants.houseNo}) = ${v.houseNo.toLowerCase()}`, others)).limit(1);
      if (clash.length) errors.houseNo = `House ${v.houseNo} already has an active tenant.`;
    }
  }

  let accountRef: string | null = null;
  if (sc?.type === "till") {
    accountRef = null;
  } else {
    accountRef = v.accountRef ?? null;
    if (sc?.type === "paybill" && !accountRef) errors.accountRef = "Enter the account number this tenant pays with.";
    if (accountRef) {
      // Unique per paybill: two buildings on different paybills may reuse the same account number.
      const sameShortcode = sc ? eq(buildings.shortcodeId, sc.id) : isNull(buildings.shortcodeId);
      const refs = await db.select({ id: tenants.id, ref: tenants.accountRef }).from(tenants).innerJoin(buildings, eq(tenants.buildingId, buildings.id)).where(sameShortcode);
      if (refs.some((r) => r.id !== o.excludeId && r.ref && normaliseRef(r.ref) === normaliseRef(accountRef!))) {
        errors.accountRef = "Another tenant on this paybill already uses this account number.";
      }
    }
  }
  return { errors: Object.keys(errors).length ? errors : null, accountRef, isTill: sc?.type === "till" };
}

export async function createTenant(input: unknown): Promise<ActionResult & { id?: string }> {
  const me = await getSession();
  if (!me) return denied;
  const parsed = tenantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fixFields, fieldErrors: toFieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    const { errors, accountRef, isTill } = await check(v, { active: true, buildingChanged: true, creating: true });
    if (errors) return { ok: false, message: fixFields, fieldErrors: errors };
    const [row] = await getDb().insert(tenants).values({
      name: v.name, nationalId: v.nationalId, phone: v.phone, buildingId: v.buildingId, houseNo: v.houseNo ?? null,
      rentAmount: v.rentAmount, accountRef, alsoPaysFrom: isTill ? v.alsoPaysFrom ?? null : null, moveInDate: v.moveInDate,
    }).returning({ id: tenants.id });
    await audit(me.adminId, "tenant.create", row.id);
    // Payments that arrived before this tenant existed can match now (paybill payments only).
    await rematchUnmatched().catch((e) => console.error("[tenants] rematch", e));
    refresh();
    return { ok: true, message: `${v.name} was added.`, id: row.id };
  } catch (e) { return failure(e); }
}

export async function updateTenant(id: string, input: unknown): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  const parsed = tenantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fixFields, fieldErrors: toFieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    const db = getDb();
    const [cur] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!cur) return { ok: false, message: "That tenant no longer exists." };

    const buildingChanged = v.buildingId !== cur.buildingId;
    if (buildingChanged) {
      // A tenant's account number belongs to one paybill/till, so they can only move between buildings that share it.
      const [[from], [to]] = await Promise.all([
        db.select({ sc: buildings.shortcodeId }).from(buildings).where(eq(buildings.id, cur.buildingId)).limit(1),
        db.select({ sc: buildings.shortcodeId }).from(buildings).where(eq(buildings.id, v.buildingId)).limit(1),
      ]);
      if (to && from?.sc !== to.sc) {
        return { ok: false, message: fixFields, fieldErrors: { buildingId: "That building collects rent on a different paybill or till. Mark this tenant as moved out and add them again there." } };
      }
    }

    const { errors, accountRef, isTill } = await check(v, { excludeId: id, active: cur.status === "active", buildingChanged, creating: false });
    if (errors) return { ok: false, message: fixFields, fieldErrors: errors };
    await db.update(tenants).set({
      name: v.name, nationalId: v.nationalId, phone: v.phone, buildingId: v.buildingId, houseNo: v.houseNo ?? null,
      rentAmount: v.rentAmount, accountRef, alsoPaysFrom: isTill ? v.alsoPaysFrom ?? null : null, moveInDate: v.moveInDate, updatedAt: new Date(),
    }).where(eq(tenants.id, id));
    await audit(me.adminId, "tenant.update", id);
    if (accountRef !== cur.accountRef) await rematchUnmatched().catch((e) => console.error("[tenants] rematch", e));
    refresh(id);
    return { ok: true, message: `${v.name} was updated.` };
  } catch (e) { return failure(e); }
}

/** Moving out frees the house but keeps the tenant's payment history. */
export async function moveOutTenant(id: string): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  try {
    const rows = await getDb().update(tenants).set({ status: "moved_out", updatedAt: new Date() })
      .where(and(eq(tenants.id, id), eq(tenants.status, "active"))).returning({ name: tenants.name });
    if (!rows.length) return { ok: false, message: "That tenant is not active." };
    await audit(me.adminId, "tenant.move_out", id);
    refresh(id);
    return { ok: true, message: `${rows[0].name} was marked as moved out.` };
  } catch (e) { return failure(e); }
}

/** Deleting is only allowed while the tenant has no payment history. Otherwise use "Mark as moved out". */
export async function deleteTenant(id: string): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  try {
    const db = getDb();
    const [t] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!t) return { ok: false, message: "That tenant no longer exists." };
    const [{ p }] = await db.select({ p: count() }).from(payments).where(eq(payments.tenantId, id));
    const [{ a }] = await db.select({ a: count() }).from(paymentAllocations).where(eq(paymentAllocations.tenantId, id));
    if (p > 0 || a > 0) return { ok: false, message: `${t.name} has payment history, so they can’t be deleted. Use “Mark as moved out” to keep the records.` };
    await db.delete(tenants).where(eq(tenants.id, id));
    await audit(me.adminId, "tenant.delete", id);
    refresh();
    return { ok: true, message: `${t.name} was deleted.` };
  } catch (e) { return failure(e); }
}
