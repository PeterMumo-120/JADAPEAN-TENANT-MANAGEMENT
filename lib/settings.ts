import { settings, SETTING_DEFAULTS } from "@/db/schema";
import { getDb } from "@/lib/db";

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingsMap = Record<SettingKey, string>;

/** Stored values merged over the defaults in db/schema.ts. */
export async function getSettings(): Promise<SettingsMap> {
  const rows = await getDb().select().from(settings);
  const out: SettingsMap = { ...SETTING_DEFAULTS };
  for (const row of rows) if (row.key in out) out[row.key as SettingKey] = row.value;
  return out;
}
