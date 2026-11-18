"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { admins, auditLog } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSession, revokeAdminSessions } from "@/lib/auth/session";

export type AdminActionResult = { ok: boolean; message: string };

const denied: AdminActionResult = { ok: false, message: "Your session has expired. Please sign in again." };

async function audit(adminId: string, action: string, targetId: string) {
  await getDb().insert(auditLog).values({ adminId, action, entity: "admin", entityId: targetId });
}

export async function approveAdmin(targetId: string): Promise<AdminActionResult> {
  const me = await getSession();
  if (!me) return denied;
  const rows = await getDb()
    .update(admins)
    .set({ status: "approved", approvedBy: me.adminId, approvedAt: new Date() })
    .where(and(eq(admins.id, targetId), eq(admins.status, "pending")))
    .returning({ id: admins.id });
  if (!rows.length) return { ok: false, message: "That request is no longer pending." };
  await audit(me.adminId, "admin.approve", targetId);
  revalidatePath("/admins");
  return { ok: true, message: "Access approved." };
}

/** Only pending requests can be rejected (deleted). Approved admins are suspended instead. */
export async function rejectAdmin(targetId: string): Promise<AdminActionResult> {
  const me = await getSession();
  if (!me) return denied;
  const rows = await getDb()
    .delete(admins)
    .where(and(eq(admins.id, targetId), eq(admins.status, "pending")))
    .returning({ id: admins.id });
  if (!rows.length) return { ok: false, message: "That request is no longer pending." };
  await audit(me.adminId, "admin.reject", targetId);
  revalidatePath("/admins");
  return { ok: true, message: "Request rejected." };
}

/** You cannot suspend yourself, which also guarantees at least one approved admin remains. */
export async function suspendAdmin(targetId: string): Promise<AdminActionResult> {
  const me = await getSession();
  if (!me) return denied;
  if (me.adminId === targetId) return { ok: false, message: "You cannot suspend your own account." };
  const rows = await getDb()
    .update(admins)
    .set({ status: "suspended" })
    .where(and(eq(admins.id, targetId), eq(admins.status, "approved")))
    .returning({ id: admins.id });
  if (!rows.length) return { ok: false, message: "That admin is not active." };
  await revokeAdminSessions(targetId); // signed out immediately
  await audit(me.adminId, "admin.suspend", targetId);
  revalidatePath("/admins");
  return { ok: true, message: "Access suspended and signed out." };
}

export async function reinstateAdmin(targetId: string): Promise<AdminActionResult> {
  const me = await getSession();
  if (!me) return denied;
  const rows = await getDb()
    .update(admins)
    .set({ status: "approved", approvedBy: me.adminId, approvedAt: new Date() })
    .where(and(eq(admins.id, targetId), eq(admins.status, "suspended")))
    .returning({ id: admins.id });
  if (!rows.length) return { ok: false, message: "That admin is not suspended." };
  await audit(me.adminId, "admin.reinstate", targetId);
  revalidatePath("/admins");
  return { ok: true, message: "Access restored." };
}
