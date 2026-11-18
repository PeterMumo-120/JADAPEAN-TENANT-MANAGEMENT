import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { admins, sessions } from "@/db/schema";
import { getDb } from "@/lib/db";

const COOKIE = "nyumba_session";

export type AdminSession = { adminId: string; firstName: string; lastName: string; phone: string };

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is missing or shorter than 16 characters.");
  return secret;
}

/** The cookie holds a random token. The database only ever stores an HMAC of it. */
async function tokenId(token: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(token));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSession(adminId: string, meta: { ip?: string | null; userAgent?: string | null }) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + (Number(process.env.SESSION_TTL_HOURS) || 12) * 3_600_000);
  await getDb().insert(sessions).values({
    id: await tokenId(token),
    adminId,
    expiresAt,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent?.slice(0, 200) ?? null,
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Returns the signed-in admin, or null. Re-checks on every request that the session is
 * unexpired AND the admin is still "approved", so suspending someone takes effect immediately.
 * Cached per request, so calling it in the layout and the page costs one query.
 */
export const getSession = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await getDb()
    .select({ adminId: admins.id, firstName: admins.firstName, lastName: admins.lastName, phone: admins.phone })
    .from(sessions)
    .innerJoin(admins, eq(admins.id, sessions.adminId))
    .where(and(eq(sessions.id, await tokenId(token)), gt(sessions.expiresAt, new Date()), eq(admins.status, "approved")))
    .limit(1);
  return rows[0] ?? null;
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.id, await tokenId(token)));
  jar.delete(COOKIE);
}

/** Sign an admin out everywhere (used when suspending). */
export async function revokeAdminSessions(adminId: string) {
  await getDb().delete(sessions).where(eq(sessions.adminId, adminId));
}
