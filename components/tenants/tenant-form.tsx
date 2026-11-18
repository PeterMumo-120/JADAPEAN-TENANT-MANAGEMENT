"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { PrimaryLink } from "@/components/layout/primary-link";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { suggestAccountRef } from "@/lib/format";
import { tenantSchema, type TenantInput, type TenantValues } from "@/lib/validators/tenants";
import { createTenant, moveOutTenant, updateTenant } from "@/lib/tenants/actions";

export type BuildingOption = { id: string; name: string; totalUnits: number; occupied: number };
export type TenantFormData = {
  id: string; name: string; nationalId: string; phone: string; buildingId: string; houseNo: string | null;
  rentAmount: number; accountRef: string; moveInDate: string; active: boolean;
};

const selectClass = "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive disabled:opacity-50";

export function TenantForm({ buildings, tenant, today }: { buildings: BuildingOption[]; tenant?: TenantFormData; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmMoveOut, setConfirmMoveOut] = useState(false);
  const form = useForm<TenantInput, unknown, TenantValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      name: tenant?.name ?? "", nationalId: tenant?.nationalId ?? "", phone: tenant?.phone ?? "",
      buildingId: tenant?.buildingId ?? "", houseNo: tenant?.houseNo ?? "", rentAmount: tenant?.rentAmount ?? 25000,
      accountRef: tenant?.accountRef ?? "", moveInDate: tenant?.moveInDate ?? today,
    },
  });
  const e = form.formState.errors;

  // New tenants get a suggested account number (building initials + house) until the admin types their own.
  const buildingId = form.watch("buildingId");
  const houseNo = form.watch("houseNo");
  const refEdited = !!form.formState.dirtyFields.accountRef;
  useEffect(() => {
    if (tenant || refEdited) return;
    const b = buildings.find((x) => x.id === buildingId);
    form.setValue("accountRef", b ? suggestAccountRef(b.name, houseNo) : "", { shouldDirty: false });
  }, [tenant, refEdited, buildingId, houseNo, buildings, form]);

  if (!tenant && buildings.length === 0) {
    return (
      <Card className="panel-card">
        <EmptyState icon={Building2} title="Add a building first"
          description="Tenants live in a building. Add your first building, then come back to add tenants."
          action={<PrimaryLink href="/buildings/new">Add building</PrimaryLink>} />
      </Card>
    );
  }

  function submit(values: TenantValues) {
    start(async () => {
      try {
        const r = tenant ? await updateTenant(tenant.id, values) : await createTenant(values);
        if (!r.ok) {
          Object.entries(r.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as "name", { message }));
          toast.error(r.message);
          return;
        }
        toast.success(r.message);
        router.push("/tenants");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function moveOut() {
    if (!tenant) return;
    setConfirmMoveOut(false);
    start(async () => {
      try {
        const r = await moveOutTenant(tenant.id);
        if (!r.ok) { toast.error(r.message); return; }
        toast.success(r.message);
        router.push("/tenants");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Card className="panel-card">
      <form className="flex flex-col gap-5 p-5 sm:p-6" onSubmit={form.handleSubmit(submit)} noValidate>
        {tenant && !tenant.active && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">This tenant has moved out. Their record is kept for payment history.</p>}
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="name" error={e.name?.message}>
            <Input id="name" placeholder="e.g. Wanjiku Mwangi" autoComplete="off" {...form.register("name")} aria-invalid={!!e.name} />
          </FormField>
          <FormField label="ID or passport number" htmlFor="nationalId" error={e.nationalId?.message}>
            <Input id="nationalId" placeholder="e.g. 12345678" autoComplete="off" {...form.register("nationalId")} aria-invalid={!!e.nationalId} />
          </FormField>
          <FormField label="Phone number" htmlFor="phone" error={e.phone?.message}>
            <Input id="phone" placeholder="0712 345 678" inputMode="tel" {...form.register("phone")} aria-invalid={!!e.phone} />
          </FormField>
          <FormField label="Move-in date" htmlFor="moveInDate" error={e.moveInDate?.message} hint="Rent is counted from this month.">
            <Input id="moveInDate" type="date" {...form.register("moveInDate")} aria-invalid={!!e.moveInDate} />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Building" htmlFor="buildingId" error={e.buildingId?.message}>
            <select id="buildingId" className={selectClass} aria-invalid={!!e.buildingId} {...form.register("buildingId")}>
              <option value="">Select a building</option>
              {buildings.map((b) => {
                const free = b.totalUnits - b.occupied;
                const full = free <= 0 && b.id !== tenant?.buildingId;
                return <option key={b.id} value={b.id} disabled={full}>{b.name} ({full ? "full" : `${Math.max(free, 0)} free`})</option>;
              })}
            </select>
          </FormField>
          <FormField label="House number (optional)" htmlFor="houseNo" error={e.houseNo?.message}>
            <Input id="houseNo" placeholder="e.g. B-204" autoComplete="off" {...form.register("houseNo")} aria-invalid={!!e.houseNo} />
          </FormField>
          <FormField label="Monthly rent (KES)" htmlFor="rentAmount" error={e.rentAmount?.message}>
            <Input id="rentAmount" type="number" min="1000" step="500" inputMode="numeric" {...form.register("rentAmount")} aria-invalid={!!e.rentAmount} />
          </FormField>
          <FormField label="Paybill account number" htmlFor="accountRef" error={e.accountRef?.message}
            hint="What this tenant types as the account number when paying.">
            <Input id="accountRef" placeholder="e.g. KC-B-204" autoComplete="off" className="font-mono uppercase" {...form.register("accountRef")} aria-invalid={!!e.accountRef} />
          </FormField>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          {tenant?.active ? (
            <Button type="button" variant="ghost" disabled={pending} className="text-destructive hover:text-destructive" onClick={() => setConfirmMoveOut(true)}>Mark as moved out</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/tenants" />}>Cancel</Button>
            <Button type="submit" disabled={pending} className="bg-primary text-white hover:bg-primary/90">
              {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}{tenant ? "Save changes" : "Add tenant"}
            </Button>
          </div>
        </div>
      </form>

      <AlertDialog open={confirmMoveOut} onOpenChange={setConfirmMoveOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {tenant?.name} as moved out?</AlertDialogTitle>
            <AlertDialogDescription>Their house becomes available again. Payment history is kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep tenant</AlertDialogCancel>
            <AlertDialogAction onClick={moveOut} className="bg-destructive text-white hover:bg-destructive/90">Mark as moved out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
