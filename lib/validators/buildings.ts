import { z } from "zod";

export const buildingSchema = z.object({
  name: z.string().trim().min(2, "Enter the building name").max(60, "Name is too long"),
  totalUnits: z.coerce.number({ error: "Enter the number of houses" }).int("Whole number only").min(1, "At least 1 house").max(1000, "That looks too high"),
  address: z.string().trim().max(120, "Keep it under 120 characters").optional().transform((v) => v || undefined),
});
export type BuildingInput = z.input<typeof buildingSchema>;
export type BuildingValues = z.output<typeof buildingSchema>;
