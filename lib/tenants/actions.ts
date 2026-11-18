"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { auditLog, buildings, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { normaliseRef } from "@/lib/format";
import { tenantSchema, type TenantValues } from "@/lib/validators/tenants";
import { toFieldErrors } from "@/lib/validators/auth";
import type { ActionResult } from "@/lib/action-result";

const denied: ActionResult = { ok: false, message: "Your session has expired. Please sign in again." };
const fixFields = "Please fix the highlighted fields.";

async function audit(adminId: string, action: string, id: string) {
  await getDb().insert(auditLog).values({ adminId, action, entity: "tenant", entityId: id });
}
function refresh() { revalidatePath("/tenants"); revalidatePath("/buildings"); revalidatePath("/dashboard"); }
function failure(e: unknown): ActionResult {
  console.error("[tenants]", e);
  const unique = e instanceof Error && /UNIQUE/i.test(e.message);
  return { ok: false, message: unique ? "That house or account number is already in use." : "Something went wrong. Please try again." };
}

/** Business rules the schema can't express. Returns field errors, or null when everything is fine. */
async function check(v: TenantValues, o: { excludeId?: string; active: boolean; buildingChanged: boolean }) {
  const db = getDb();
  const errors: Record<string, string> = {};
  const [b] = await db.select().from(buildings).where(eq(buildings.id, v.buildingId)).limit(1);
  if (!b) return { buildingId: "That building no longer exists." };
  const others = o.excludeId ? ne(tenants.id, o.excludeId) : undefined;

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
  const refs = await db.select({ id: tenants.id, ref: tenants.accountRef }).from(tenants);
  if (refs.some((r) => r.id !== o.excludeId && normaliseRef(r.ref) === normaliseRef(v.accountRef))) {
    errors.accountRef = "Another tenant already uses this account number.";
  }
  return Object.keys(errors).length ? errors : null;
}

export async function createTenant(input: unknown): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  const parsed = tenantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fixFields, fieldErrors: toFieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    const errors = await check(v, { active: true, buildingChanged: true });
    if (errors) return { ok: false, message: fixFields, fieldErrors: errors };
    const [row] = await getDb().insert(tenants).values({
      name: v.name, nationalId: v.nationalId, phone: v.phone, buildingId: v.buildingId, houseNo: v.houseNo ?? null,
      rentAmount: v.rentAmount, accountRef: v.accountRef, moveInDate: v.moveInDate,
    }).returning({ id: tenants.id });
    await audit(me.adminId, "tenant.create", row.id);
    refresh();
    return { ok: true, message: `${v.name} was added.` };
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
    const errors = await check(v, { excludeId: id, active: cur.status === "active", buildingChanged: v.buildingId !== cur.buildingId });
    if (errors) return { ok: false, message: fixFields, fieldErrors: errors };
    await db.update(tenants).set({
      name: v.name, nationalId: v.nationalId, phone: v.phone, buildingId: v.buildingId, houseNo: v.houseNo ?? null,
      rentAmount: v.rentAmount, accountRef: v.accountRef, moveInDate: v.moveInDate, updatedAt: new Date(),
    }).where(eq(tenants.id, id));
    await audit(me.adminId, "tenant.update", id);
    refresh();
    return { ok: true, message: `${v.name} was updated.` };
  } catch (e) { return failure(e); }
}

/** Tenants are never deleted: moving out frees the house but keeps their payment history. */
export async function moveOutTenant(id: string): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  try {
    const rows = await getDb().update(tenants).set({ status: "moved_out", updatedAt: new Date() })
      .where(and(eq(tenants.id, id), eq(tenants.status, "active"))).returning({ name: tenants.name });
    if (!rows.length) return { ok: false, message: "That tenant is not active." };
    await audit(me.adminId, "tenant.move_out", id);
    refresh();
    return { ok: true, message: `${rows[0].name} was marked as moved out.` };
  } catch (e) { return failure(e); }
}
