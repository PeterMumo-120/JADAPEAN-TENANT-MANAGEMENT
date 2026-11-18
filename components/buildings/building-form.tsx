"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { buildingSchema, type BuildingInput, type BuildingValues } from "@/lib/validators/buildings";
import { createBuilding, deleteBuilding, updateBuilding } from "@/lib/buildings/actions";

export type BuildingFormData = { id: string; name: string; totalUnits: number; address: string | null };

export function BuildingForm({ building }: { building?: BuildingFormData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = useForm<BuildingInput, unknown, BuildingValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: { name: building?.name ?? "", totalUnits: building?.totalUnits ?? 10, address: building?.address ?? "" },
  });
  const e = form.formState.errors;

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
        router.push("/buildings");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function remove() {
    if (!building) return;
    setConfirmDelete(false);
    start(async () => {
      try {
        const r = await deleteBuilding(building.id);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        router.push("/buildings");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Card className="panel-card">
      <form className="flex flex-col gap-5 p-5 sm:p-6" onSubmit={form.handleSubmit(submit)} noValidate>
        <FormField label="Building name" htmlFor="name" error={e.name?.message}>
          <Input id="name" placeholder="e.g. Kijani Court" autoComplete="off" {...form.register("name")} aria-invalid={!!e.name} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Number of houses" htmlFor="totalUnits" error={e.totalUnits?.message} hint="Total houses available to rent.">
            <Input id="totalUnits" type="number" min="1" inputMode="numeric" {...form.register("totalUnits")} aria-invalid={!!e.totalUnits} />
          </FormField>
          <FormField label="Area (optional)" htmlFor="address" error={e.address?.message} hint="e.g. Kilimani, Nairobi">
            <Input id="address" placeholder="Kilimani, Nairobi" {...form.register("address")} aria-invalid={!!e.address} />
          </FormField>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          {building ? (
            <Button type="button" variant="ghost" disabled={pending} className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>Delete building</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/buildings" />}>Cancel</Button>
            <Button type="submit" disabled={pending} className="bg-primary text-white hover:bg-primary/90">
              {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}{building ? "Save changes" : "Add building"}
            </Button>
          </div>
        </div>
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {building?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This can’t be undone. Buildings that have tenants on record can’t be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep building</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90">Delete building</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
