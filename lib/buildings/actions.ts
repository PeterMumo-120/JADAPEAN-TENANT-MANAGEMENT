"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { auditLog, buildings, tenants } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { buildingSchema } from "@/lib/validators/buildings";
import { toFieldErrors } from "@/lib/validators/auth";
import type { ActionResult } from "@/lib/action-result";

const denied: ActionResult = { ok: false, message: "Your session has expired. Please sign in again." };
const fixFields = "Please fix the highlighted fields.";

async function audit(adminId: string, action: string, id: string) {
  await getDb().insert(auditLog).values({ adminId, action, entity: "building", entityId: id });
}
function refresh() { revalidatePath("/buildings"); revalidatePath("/tenants"); revalidatePath("/dashboard"); }
function failure(e: unknown): ActionResult {
  console.error("[buildings]", e);
  const unique = e instanceof Error && /UNIQUE/i.test(e.message);
  return { ok: false, message: unique ? "A building with that name already exists." : "Something went wrong. Please try again." };
}
const nameTaken = (name: string, excludeId?: string) =>
  getDb().select({ id: buildings.id }).from(buildings)
    .where(and(sql`lower(${buildings.name}) = ${name.toLowerCase()}`, excludeId ? ne(buildings.id, excludeId) : undefined)).limit(1);

export async function createBuilding(input: unknown): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  const parsed = buildingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fixFields, fieldErrors: toFieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    if ((await nameTaken(v.name)).length) return { ok: false, message: fixFields, fieldErrors: { name: "You already have a building with this name." } };
    const [row] = await getDb().insert(buildings).values({ name: v.name, totalUnits: v.totalUnits, address: v.address ?? null }).returning({ id: buildings.id });
    await audit(me.adminId, "building.create", row.id);
    refresh();
    return { ok: true, message: `${v.name} was added.` };
  } catch (e) { return failure(e); }
}

export async function updateBuilding(id: string, input: unknown): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  const parsed = buildingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fixFields, fieldErrors: toFieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    const db = getDb();
    const [cur] = await db.select({ id: buildings.id }).from(buildings).where(eq(buildings.id, id)).limit(1);
    if (!cur) return { ok: false, message: "That building no longer exists." };
    if ((await nameTaken(v.name, id)).length) return { ok: false, message: fixFields, fieldErrors: { name: "You already have a building with this name." } };
    const [{ n }] = await db.select({ n: count() }).from(tenants).where(and(eq(tenants.buildingId, id), eq(tenants.status, "active")));
    if (v.totalUnits < n) return { ok: false, message: fixFields, fieldErrors: { totalUnits: `${n} houses are occupied. Use at least ${n}.` } };
    await db.update(buildings).set({ name: v.name, totalUnits: v.totalUnits, address: v.address ?? null }).where(eq(buildings.id, id));
    await audit(me.adminId, "building.update", id);
    refresh();
    return { ok: true, message: `${v.name} was updated.` };
  } catch (e) { return failure(e); }
}

/** A building that has (or ever had) tenants cannot be deleted, because payment history points at them. */
export async function deleteBuilding(id: string): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  try {
    const db = getDb();
    const [b] = await db.select().from(buildings).where(eq(buildings.id, id)).limit(1);
    if (!b) return { ok: false, message: "That building no longer exists." };
    const [{ n }] = await db.select({ n: count() }).from(tenants).where(eq(tenants.buildingId, id));
    if (n > 0) return { ok: false, message: `${b.name} has ${n} tenant${n === 1 ? "" : "s"} on record, so it can’t be deleted.` };
    await db.delete(buildings).where(eq(buildings.id, id));
    await audit(me.adminId, "building.delete", id);
    refresh();
    return { ok: true, message: `${b.name} was deleted.` };
  } catch (e) { return failure(e); }
}
