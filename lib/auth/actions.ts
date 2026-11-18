"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { admins } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { hashPasscode, verifyPasscode } from "@/lib/passcode";
import { createSession, destroySession } from "@/lib/auth/session";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { LIMITS, clearFailures, clientIp, recentAttempts, recordAttempt } from "@/lib/auth/rate-limit";
import { loginSchema, registerSchema, toFieldErrors } from "@/lib/validators/auth";

export type AuthState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /** Non-secret inputs echoed back, because React 19 clears uncontrolled fields after an action. */
  values?: Record<string, string>;
};

// Used so an unknown phone number costs the same time as a wrong passcode.
const DUMMY_SALT = "00112233445566778899aabbccddeeff";
const DUMMY_HASH = "0".repeat(64);

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");

export async function loginAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const raw = { phone: text(fd, "phone"), passcode: text(fd, "passcode") };
  const values = { phone: raw.phone };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const h = await headers();
  const ip = clientIp(h);
  if (!(await verifyTurnstile(text(fd, "cf-turnstile-response"), ip))) {
    return { error: "We could not verify that you are human. Please try again.", values };
  }

  const { phone, passcode } = parsed.data;
  const [ipFails, phoneFails] = await Promise.all([
    recentAttempts(`ip:${ip}`, LIMITS.loginPerIp.windowSeconds),
    recentAttempts(`phone:${phone}`, LIMITS.loginPerPhone.windowSeconds),
  ]);
  if (ipFails >= LIMITS.loginPerIp.max || phoneFails >= LIMITS.loginPerPhone.max) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", values };
  }

  const db = getDb();
  const admin = await db.query.admins.findFirst({ where: eq(admins.phone, phone) });
  const passcodeOk = admin
    ? await verifyPasscode(passcode, admin.passcodeHash, admin.passcodeSalt)
    : (await verifyPasscode(passcode, DUMMY_HASH, DUMMY_SALT), false);

  if (!admin || !passcodeOk) {
    await Promise.all([recordAttempt(`ip:${ip}`, false), recordAttempt(`phone:${phone}`, false)]);
    return { error: "Incorrect phone number or passcode.", values };
  }

  // Only revealed AFTER a correct passcode, so phone numbers cannot be probed.
  if (admin.status === "pending") return { error: "Your account is waiting for approval by an existing admin.", values };
  if (admin.status === "suspended") return { error: "Your access has been suspended. Please contact an admin.", values };

  await clearFailures(`phone:${phone}`);
  await createSession(admin.id, { ip, userAgent: h.get("user-agent") });
  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
  redirect("/dashboard");
}

export async function registerAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const raw = {
    firstName: text(fd, "firstName"),
    lastName: text(fd, "lastName"),
    phone: text(fd, "phone"),
    passcode: text(fd, "passcode"),
    confirmPasscode: text(fd, "confirmPasscode"),
  };
  const values = { firstName: raw.firstName, lastName: raw.lastName, phone: raw.phone };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const ip = clientIp(await headers());
  if (!(await verifyTurnstile(text(fd, "cf-turnstile-response"), ip))) {
    return { error: "We could not verify that you are human. Please try again.", values };
  }

  const key = `reg:${ip}`;
  if ((await recentAttempts(key, LIMITS.registerPerIp.windowSeconds, false)) >= LIMITS.registerPerIp.max) {
    return { error: "Too many requests from this network. Please try again later.", values };
  }
  await recordAttempt(key, true);

  const settings = await getSettings();
  if (settings.registration_open !== "true") {
    return { error: "Registration is closed. Ask an existing admin to open it.", values };
  }

  const db = getDb();
  const [{ n: pending }] = await db.select({ n: count() }).from(admins).where(eq(admins.status, "pending"));
  if (pending >= Number(settings.max_pending_admins)) {
    return { error: "There are too many pending requests right now. Please try again later.", values };
  }

  const { firstName, lastName, phone, passcode } = parsed.data;
  const { hash, salt } = await hashPasscode(passcode);
  // Same reply whether or not the number already exists, so numbers cannot be probed.
  await db
    .insert(admins)
    .values({ firstName, lastName, phone, passcodeHash: hash, passcodeSalt: salt, status: "pending" })
    .onConflictDoNothing({ target: admins.phone });

  return { success: "Request received. An existing admin must approve your account before you can sign in." };
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
