import { z } from "zod";
import { normalisePhone } from "@/lib/phone";

const optionalText = (max: number, msg: string) =>
  z.string().trim().max(max, msg).optional().transform((v) => v || undefined);

export const shortcodeSchema = z.object({
  label: z.string().trim().min(2, "Give it a name you will recognise").max(40, "Keep the name under 40 characters"),
  type: z.enum(["paybill", "till"], { error: "Choose paybill or till" }),
  number: z.string().trim().regex(/^\d{5,7}$/, "Enter the 5 to 7 digit number"),
  env: z.enum(["sandbox", "production"], { error: "Choose sandbox or production" }),
  // Tills only. Off = never auto-assign, Balanced = clear score lead, Strict = learned payer, or name AND phone digits.
  matchMode: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(["off", "balanced", "strict"]).optional()),
  consumerKey: optionalText(200, "That key is too long"),
  consumerSecret: optionalText(300, "That secret is too long"),
  nominatedNumber: z.string().trim().optional().transform((v, ctx) => {
    if (!v) return undefined;
    const n = normalisePhone(v);
    if (!n) { ctx.addIssue({ code: "custom", message: "Enter a valid Safaricom number" }); return z.NEVER; }
    return n;
  }),
}).superRefine((v, ctx) => {
  if (v.type === "till" && !v.matchMode) ctx.addIssue({ code: "custom", path: ["matchMode"], message: "Choose how till payments are matched" });
});
export type ShortcodeInput = z.input<typeof shortcodeSchema>;
export type ShortcodeValues = z.output<typeof shortcodeSchema>;