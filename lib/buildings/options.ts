import type { BuildingStat } from "@/lib/buildings/queries";
import type { BuildingOption } from "@/components/tenants/tenant-form";

/** Shapes building stats for the tenant form's building dropdown. */
export const toBuildingOptions = (list: BuildingStat[]): BuildingOption[] =>
  list.map((b) => ({
    id: b.id, name: b.name, totalUnits: b.totalUnits, occupied: b.occupied, archived: b.archived,
    shortcodeId: b.shortcode?.id ?? null, shortcodeType: b.shortcode?.type ?? null, shortcodeNumber: b.shortcode?.number ?? null,
  }));
