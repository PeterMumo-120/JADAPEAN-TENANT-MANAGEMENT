import { z } from "zod";
import { normalisePhone } from "@/lib/phone";

const phone = z.string().trim().transform((value, ctx) => {
  const normalised = normalisePhone(value);
  if (!normalised) {
    ctx.addIssue({ code: "custom", message: "Enter a valid Kenyan mobile number" });
    return z.NEVER;
  }
  return normalised;
});

export const tenantSchema = z.object({
  name: z.string().trim().min(3, "Enter the tenant’s full name").max(80, "Name is too long")
    .regex(/^\p{L}[\p{L}\s'’.-]*$/u, "Use letters only for the name"),
  nationalId: z.string().trim().regex(/^[A-Za-z0-9]{6,12}$/, "Enter a valid ID or passport number"),
  phone,
  buildingId: z.string().min(1, "Select a building"),
  houseNo: z.string().trim().max(20, "House number is too long").optional().transform((v) => v || undefined),
  rentAmount: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number({ error: "Enter the monthly rent" }).int("Whole shillings only").min(1000, "Rent must be at least KES 1,000").max(1_000_000, "That looks too high")),
  // Only used for paybill buildings. Whether it is required depends on the building, so the form and the server check that.
  accountRef: z.string().trim().max(20, "Keep it to 20 characters")
    .refine((v) => !v || v.length >= 2, "Enter at least 2 characters")
    .refine((v) => !v || /^[A-Za-z0-9-]+$/.test(v), "Letters, numbers and dashes only")
    .optional().transform((v) => (v ? v.toUpperCase() : undefined)),
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the move-in date").refine((v) => !Number.isNaN(Date.parse(v)), "Pick a valid date"),
});
export type TenantInput = z.input<typeof tenantSchema>;
export type TenantValues = z.output<typeof tenantSchema>;
