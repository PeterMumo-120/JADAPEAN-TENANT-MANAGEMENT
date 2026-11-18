import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/**
 * Call this at the top of EVERY protected page (and every server component that reads data).
 * Layouts do not re-run on client-side navigation, so the layout check alone is not enough.
 * Server actions use getSession() directly and return an error instead of redirecting.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}
