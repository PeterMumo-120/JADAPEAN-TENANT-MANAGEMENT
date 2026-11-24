"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Landmark, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { PrimaryLink } from "@/components/layout/primary-link";
import { buildingSchema, type BuildingInput, type BuildingValues } from "@/lib/validators/buildings";
import { createBuilding, updateBuilding } from "@/lib/buildings/actions";

export type BuildingFormData = { id: string; name: string; totalUnits: number; address: string | null; shortcodeId: string | null };
export type ShortcodeOption = { id: string; label: string; type: "paybill" | "till"; number: string };

const selectClass = "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive disabled:opacity-50";
const typeName = (t: "paybill" | "till") => (t === "till" ? "Till" : "Paybill");

export function BuildingForm({ building, shortcodes }: { building?: BuildingFormData; shortcodes: ShortcodeOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<BuildingInput, unknown, BuildingValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: { name: building?.name ?? "", totalUnits: building?.totalUnits ?? "", address: building?.address ?? "", shortcodeId: building?.shortcodeId ?? "" },
  });
  const e = form.formState.errors;
  const chosen = shortcodes.find((s) => s.id === form.watch("shortcodeId"));
  const locked = !!building?.shortcodeId; // permanent once set
  const lockedShortcode = locked ? shortcodes.find((s) => s.id === building!.shortcodeId) : undefined;
  const back = building ? `/buildings/${building.id}` : "/buildings";

  if (!building && shortcodes.length === 0) {
    return (
      <Card className="panel-card">
        <EmptyState icon={Landmark} title="Add a payment number first"
          description="Every building is linked to the M-Pesa number its tenants pay rent to. Add that number, then come back to create the building."
          action={<PrimaryLink href="/shortcodes/new">Add payment number</PrimaryLink>} />
      </Card>
    );
  }

  function submit(values: BuildingValues) {
    start(async () => {
      try {
        const r = building ? await updateBuilding(building.id, values) : await createBuilding(values);
        if (!r.ok) {
          Object.entries(r.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as "name", { message }));
          toast.error(r.message);
          return;
        }
        toast.success(r.message);
        router.push(building ? `/buildings/${building.id}` : "/buildings");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Card className="panel-card">
      <form className="flex flex-col gap-5 p-5 sm:p-6" onSubmit={form.handleSubmit(submit)} noValidate autoComplete="off">
        <FormField label="Building name" htmlFor="name" error={e.name?.message}>
          <Input id="name" placeholder="e.g. Kijani Court" {...form.register("name")} aria-invalid={!!e.name} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Number of houses" htmlFor="totalUnits" error={e.totalUnits?.message} hint="Total houses available to rent.">
            <Input id="totalUnits" type="number" min="1" inputMode="numeric" placeholder="e.g. 24" {...form.register("totalUnits")} aria-invalid={!!e.totalUnits} />
          </FormField>
          <FormField label="Area (optional)" htmlFor="address" error={e.address?.message} hint="e.g. Kilimani, Nairobi">
            <Input id="address" placeholder="Kilimani, Nairobi" {...form.register("address")} aria-invalid={!!e.address} />
          </FormField>
        </div>

        {locked ? (
          <div>
            <p className="text-xs font-medium">Rent is paid to</p>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
              <Lock className="size-3.5 text-muted-foreground" />
              {lockedShortcode ? <span>{lockedShortcode.label} <span className="font-mono text-xs text-muted-foreground">· {typeName(lockedShortcode.type)} {lockedShortcode.number}</span></span> : <span className="text-muted-foreground">Attached</span>}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">This can’t be changed. To collect on a different paybill or till, add a new building and archive this one.</p>
          </div>
        ) : (
          <FormField label="Rent is paid to" htmlFor="shortcodeId" error={e.shortcodeId?.message}
            hint={chosen ? (chosen.type === "paybill" ? "Each tenant gets an account number to type when paying. Payments are matched to them automatically." : "Tenants pay to a till, so there is no account number. The app suggests who each payment is from, and you check it.") : building ? "This building has none yet. Once you pick one it is permanent." : "Permanent once the building is created."}>
            <select id="shortcodeId" className={selectClass} aria-invalid={!!e.shortcodeId} {...form.register("shortcodeId")}>
              <option value="">Choose the M-Pesa number</option>
              {shortcodes.map((s) => <option key={s.id} value={s.id}>{s.label} — {typeName(s.type)} {s.number}</option>)}
            </select>
          </FormField>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="outline" render={<Link href={back} />}>Cancel</Button>
          <Button type="submit" disabled={pending} className="bg-primary text-white hover:bg-primary/90">
            {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}{building ? "Save changes" : "Add building"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
