import { z } from "zod";

export const markPaidSchema = z.object({
  amount: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number({ error: "Enter the amount received" }).int("Whole shillings only").min(1, "Enter at least KES 1").max(10_000_000, "That looks too high")),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date received").refine((v) => !Number.isNaN(Date.parse(v)), "Pick a valid date"),
  reference: z.string().trim().max(20, "Keep it to 20 characters").refine((v) => !v || /^[A-Za-z0-9]{6,20}$/.test(v), "Letters and numbers only (e.g. the M-Pesa code)")
    .optional().transform((v) => (v ? v.toUpperCase() : undefined)),
  note: z.string().trim().max(120, "Keep it under 120 characters").optional().transform((v) => v || undefined),
});
export type MarkPaidInput = z.input<typeof markPaidSchema>;
export type MarkPaidValues = z.output<typeof markPaidSchema>;
