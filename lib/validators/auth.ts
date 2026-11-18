import { z } from "zod";
import { normalisePhone } from "@/lib/phone";

const personName = (label: string) =>
  z.string().trim()
    .min(2, `Enter your ${label}`)
    .max(40, `${label[0].toUpperCase()}${label.slice(1)} is too long`)
    .regex(/^\p{L}[\p{L}\s'’.-]*$/u, `Use letters only for your ${label}`);

const phone = z.string().trim().transform((value, ctx) => {
  const normalised = normalisePhone(value);
  if (!normalised) {
    ctx.addIssue({ code: "custom", message: "Enter a valid Kenyan mobile number" });
    return z.NEVER;
  }
  return normalised;
});

export const loginSchema = z.object({
  phone,
  passcode: z.string().min(1, "Enter your passcode").max(128),
});

export const registerSchema = z
  .object({
    firstName: personName("first name"),
    lastName: personName("last name"),
    phone,
    passcode: z.string().min(8, "Use at least 8 characters").max(128),
    confirmPasscode: z.string(),
  })
  .refine((d) => d.passcode === d.confirmPasscode, { path: ["confirmPasscode"], message: "Passcodes do not match" });

/** First message per field, ready to show under inputs. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
