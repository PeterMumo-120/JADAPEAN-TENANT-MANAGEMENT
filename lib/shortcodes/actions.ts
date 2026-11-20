"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { auditLog, buildings, payments, shortcodes } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/mpesa/crypto";
import { ALREADY_REGISTERED, DarajaError, registerC2B, registerPull, testCredentials } from "@/lib/mpesa/client";
import { callbackUrls, urlProblem } from "@/lib/mpesa/config";
import { credsFor, getShortcode } from "@/lib/mpesa/shortcodes";
import { shortcodeSchema } from "@/lib/validators/shortcodes";
import { toFieldErrors } from "@/lib/validators/auth";
import type { ActionResult } from "@/lib/action-result";

const denied: ActionResult = { ok: false, message: "Your session has expired. Please sign in again." };
const fixFields = "Please fix the highlighted fields.";

async function audit(adminId: string, action: string, id: string) {
  await getDb().insert(auditLog).values({ adminId, action, entity: "shortcode", entityId: id });
}
function refresh() { ["/shortcodes", "/buildings", "/payments", "/dashboard"].forEach((p) => revalidatePath(p)); }
function failure(e: unknown): ActionResult {
  console.error("[shortcodes]", e);
  if (e instanceof Error && /UNIQUE/i.test(e.message)) return { ok: false, message: "That number is already saved." };
  return { ok: false, message: e instanceof Error && e.message.length < 200 ? e.message : "Something went wrong. Please try again." };
}

export async function createShortcode(input: unknown): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  const parsed = shortcodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fixFields, fieldErrors: toFieldErrors(parsed.error) };
  const v = parsed.data;
  if ((v.consumerKey && !v.consumerSecret) || (!v.consumerKey && v.consumerSecret)) {
    return { ok: false, message: fixFields, fieldErrors: { [v.consumerKey ? "consumerSecret" : "consumerKey"]: "Add both the key and the secret, or leave both empty for now." } };
  }
  try {
    const db = getDb();
    const [dup] = await db.select({ id: shortcodes.id }).from(shortcodes).where(eq(shortcodes.number, v.number)).limit(1);
    if (dup) return { ok: false, message: fixFields, fieldErrors: { number: "This number is already saved." } };
    const [row] = await db.insert(shortcodes).values({
      label: v.label, type: v.type, number: v.number, env: v.env, consumerKey: v.consumerKey ?? null,
      consumerSecretEnc: v.consumerSecret ? await encryptSecret(v.consumerSecret) : null, nominatedNumber: v.nominatedNumber ?? null,
    }).returning({ id: shortcodes.id });
    await audit(me.adminId, "shortcode.create", row.id);
    refresh();
    return { ok: true, message: `${v.label} was added.` };
  } catch (e) { return failure(e); }
}

export async function updateShortcode(id: string, input: unknown): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  const parsed = shortcodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fixFields, fieldErrors: toFieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    const db = getDb();
    const cur = await getShortcode(id);
    if (!cur) return { ok: false, message: "That shortcode no longer exists." };

    // Type and number are locked once buildings or payments depend on them.
    const [{ b }] = await db.select({ b: count() }).from(buildings).where(eq(buildings.shortcodeId, id));
    const [{ p }] = await db.select({ p: count() }).from(payments).where(eq(payments.shortcodeId, id));
    if ((b > 0 || p > 0) && (v.type !== cur.type || v.number !== cur.number)) {
      return { ok: false, message: fixFields, fieldErrors: { number: "The type and number are locked because buildings or payments use this shortcode. Add a new one instead." } };
    }
    const [dup] = await db.select({ id: shortcodes.id }).from(shortcodes).where(and(eq(shortcodes.number, v.number), ne(shortcodes.id, id))).limit(1);
    if (dup) return { ok: false, message: fixFields, fieldErrors: { number: "This number is already saved." } };

    const key = v.consumerKey ?? cur.consumerKey;
    const secretEnc = v.consumerSecret ? await encryptSecret(v.consumerSecret) : cur.consumerSecretEnc;
    if (!!key !== !!secretEnc) return { ok: false, message: fixFields, fieldErrors: { [key ? "consumerSecret" : "consumerKey"]: "Add both the key and the secret." } };

    const envChanged = v.env !== cur.env || v.number !== cur.number;
    await db.update(shortcodes).set({
      label: v.label, type: v.type, number: v.number, env: v.env, consumerKey: key, consumerSecretEnc: secretEnc,
      nominatedNumber: v.nominatedNumber ?? null,
      // A different environment or number means the old registrations no longer apply.
      ...(envChanged ? { urlsRegisteredAt: null, pullRegisteredAt: null, lastSyncError: null } : {}),
    }).where(eq(shortcodes.id, id));
    await audit(me.adminId, "shortcode.update", id);
    refresh();
    return { ok: true, message: `${v.label} was updated.${envChanged ? " Register its URLs again." : ""}` };
  } catch (e) { return failure(e); }
}

/** Inactive shortcodes are not offered for new buildings and are skipped by the sync. Existing buildings keep working. */
export async function setShortcodeActive(id: string, active: boolean): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  try {
    const rows = await getDb().update(shortcodes).set({ active }).where(eq(shortcodes.id, id)).returning({ label: shortcodes.label });
    if (!rows.length) return { ok: false, message: "That shortcode no longer exists." };
    await audit(me.adminId, active ? "shortcode.activate" : "shortcode.deactivate", id);
    refresh();
    return { ok: true, message: `${rows[0].label} is now ${active ? "active" : "inactive"}.` };
  } catch (e) { return failure(e); }
}

export async function deleteShortcode(id: string): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  try {
    const db = getDb();
    const cur = await getShortcode(id);
    if (!cur) return { ok: false, message: "That shortcode no longer exists." };
    const [{ b }] = await db.select({ b: count() }).from(buildings).where(eq(buildings.shortcodeId, id));
    const [{ p }] = await db.select({ p: count() }).from(payments).where(eq(payments.shortcodeId, id));
    if (b > 0 || p > 0) return { ok: false, message: `${cur.label} is used by ${b} building${b === 1 ? "" : "s"} and ${p} payment${p === 1 ? "" : "s"}, so it can’t be deleted. Deactivate it instead.` };
    await db.delete(shortcodes).where(eq(shortcodes.id, id));
    await audit(me.adminId, "shortcode.delete", id);
    refresh();
    return { ok: true, message: `${cur.label} was deleted.` };
  } catch (e) { return failure(e); }
}

/** "Test keys": asks Daraja for an access token with the saved key and secret. */
export async function testShortcodeKeys(id: string): Promise<ActionResult> {
  if (!(await getSession())) return denied;
  try {
    const sc = await getShortcode(id);
    if (!sc) return { ok: false, message: "That shortcode no longer exists." };
    await testCredentials(await credsFor(sc));
    return { ok: true, message: `Keys work. Daraja issued an access token for ${sc.label}.` };
  } catch (e) { return failure(e); }
}

const registered = (e: unknown) => e instanceof DarajaError && ALREADY_REGISTERED.test(e.body);

/** One-time C2B Register URL call for this shortcode, using its own Daraja app. */
export async function registerShortcodeUrls(id: string): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  try {
    const sc = await getShortcode(id);
    if (!sc) return { ok: false, message: "That shortcode no longer exists." };
    const urls = callbackUrls();
    const bad = urlProblem(urls.confirmation, sc.env) ?? urlProblem(urls.validation, sc.env);
    if (bad) return { ok: false, message: bad };
    let note = "";
    try {
      const r = await registerC2B(await credsFor(sc), urls);
      if (String(r.ResponseCode ?? "0") !== "0") return { ok: false, message: `Daraja said: ${String(r.ResponseDescription ?? "registration failed")}` };
    } catch (e) {
      if (!registered(e)) throw e;
      note = " (They were already registered.)";
    }
    await getDb().update(shortcodes).set({ urlsRegisteredAt: new Date() }).where(eq(shortcodes.id, id));
    await audit(me.adminId, "shortcode.register_urls", id);
    refresh();
    return { ok: true, message: `Confirmation and validation URLs registered for ${sc.label}.${note}` };
  } catch (e) { return failure(e); }
}

/** One-time Pull Transactions registration, so the sync can recover payments that missed the webhook. */
export async function registerShortcodePull(id: string): Promise<ActionResult> {
  const me = await getSession();
  if (!me) return denied;
  try {
    const sc = await getShortcode(id);
    if (!sc) return { ok: false, message: "That shortcode no longer exists." };
    const url = callbackUrls().confirmation;
    let note = "";
    try {
      const r = await registerPull(await credsFor(sc), url);
      const code = String(r.ResponseStatus ?? r.ResponseCode ?? "1000");
      if (code === "1001") note = " (It was already registered.)";
      else if (code !== "1000" && code !== "0") return { ok: false, message: `Daraja said: ${String(r.ResponseDescription ?? "registration failed")}` };
    } catch (e) {
      if (!registered(e)) throw e;
      note = " (It was already registered.)";
    }
    await getDb().update(shortcodes).set({ pullRegisteredAt: new Date() }).where(eq(shortcodes.id, id));
    await audit(me.adminId, "shortcode.register_pull", id);
    refresh();
    return { ok: true, message: `Pull Transactions registered for ${sc.label}.${note}` };
  } catch (e) { return failure(e); }
}
