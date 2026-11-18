"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { settings } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { toFieldErrors } from "@/lib/validators/auth";

export type SettingsState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  rent_due_day: z.coerce.number().int("Enter a whole number").min(1, "Pick a day from 1 to 28").max(28, "Pick a day from 1 to 28"),
  grace_days: z.coerce.number().int("Enter a whole number").min(0, "Cannot be negative").max(15, "Maximum is 15 days"),
  sync_cooldown_seconds: z.coerce.number().int("Enter a whole number").min(10, "Minimum is 10 seconds").max(3600, "Maximum is 3600 seconds"),
  registration_open: z.enum(["true", "false"]),
});

export async function saveSettingsAction(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const me = await getSession();
  if (!me) return { error: "Your session has expired. Please sign in again." };

  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const db = getDb();
  const writes = Object.entries(parsed.data).map(([key, value]) =>
    db
      .insert(settings)
      .values({ key, value: String(value), updatedBy: me.adminId })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value), updatedBy: me.adminId, updatedAt: new Date() } }),
  );
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
  revalidatePath("/settings");
  return { ok: true };
}
