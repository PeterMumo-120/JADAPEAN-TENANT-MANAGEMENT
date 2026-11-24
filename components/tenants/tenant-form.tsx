"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Building2, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { PrimaryLink } from "@/components/layout/primary-link";
import { tenantSchema, type TenantInput, type TenantValues } from "@/lib/validators/tenants";
import { createTenant, updateTenant } from "@/lib/tenants/actions";

export type BuildingOption = {
  id: string; name: string; totalUnits: number; occupied: number; archived: boolean;
  shortcodeId: string | null; shortcodeType: "paybill" | "till" | null; shortcodeNumber: string | null;
};
export type TenantFormData = {
  id: string; name: string; nationalId: string; phone: string; buildingId: string; houseNo: string | null;
  rentAmount: number; accountRef: string | null; alsoPaysFrom: string | null; moveInDate: string; active: boolean;
};

const selectClass = "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive disabled:opacity-50";

export function TenantForm({ buildings, tenant }: { buildings: BuildingOption[]; tenant?: TenantFormData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<TenantInput, unknown, TenantValues>({
    resolver: zodResolver(tenantSchema),
    // Everything starts empty for a new tenant. Nothing is pre-filled.
    defaultValues: {
      name: tenant?.name ?? "", nationalId: tenant?.nationalId ?? "", phone: tenant?.phone ?? "",
      buildingId: tenant?.buildingId ?? "", houseNo: tenant?.houseNo ?? "", rentAmount: tenant?.rentAmount ?? "",
      accountRef: tenant?.accountRef ?? "", alsoPaysFrom: tenant?.alsoPaysFrom ?? "", moveInDate: tenant?.moveInDate ?? "",
    },
  });
  const e = form.formState.errors;
  const buildingId = form.watch("buildingId");
  const chosen = buildings.find((b) => b.id === buildingId);
  const currentShortcode = tenant ? buildings.find((b) => b.id === tenant.buildingId)?.shortcodeId ?? null : null;
  const back = tenant ? `/tenants/${tenant.id}` : "/tenants";

  if (!tenant && buildings.filter((b) => !b.archived).length === 0) {
    return (
      <Card className="panel-card">
        <EmptyState icon={Building2} title="Add a building first"
          description="Tenants live in a building. Add your first building, then come back to add tenants."
          action={<PrimaryLink href="/buildings/new">Add building</PrimaryLink>} />
      </Card>
    );
  }

  function submit(values: TenantValues) {
    if (chosen?.shortcodeType === "paybill" && !values.accountRef) {
      form.setError("accountRef", { message: "Enter the account number this tenant pays with." });
      return;
    }
    start(async () => {
      try {
        const payload = chosen?.shortcodeType === "till" ? { ...values, accountRef: undefined } : { ...values, alsoPaysFrom: undefined };
        const r = tenant ? await updateTenant(tenant.id, payload) : await createTenant(payload);
        if (!r.ok) {
          Object.entries(r.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as "name", { message }));
          toast.error(r.message);
          return;
        }
        toast.success(r.message);
        router.push(tenant ? `/tenants/${tenant.id}` : "id" in r && r.id ? `/tenants/${r.id}` : "/tenants");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function optionState(b: BuildingOption) {
    if (b.id === tenant?.buildingId) return { disabled: false, note: "" };
    if (b.archived) return { disabled: true, note: "archived" };
    if (tenant) {
      // Account numbers belong to one paybill/till, so existing tenants can only move within the same one.
      if (b.shortcodeId !== currentShortcode) return { disabled: true, note: "different paybill/till" };
    } else if (!b.shortcodeId) return { disabled: true, note: "no paybill/till yet" };
    if (b.totalUnits - b.occupied <= 0) return { disabled: true, note: "full" };
    return { disabled: false, note: `${b.totalUnits - b.occupied} free` };
  }

  return (
    <Card className="panel-card">
      <form className="flex flex-col gap-5 p-5 sm:p-6" onSubmit={form.handleSubmit(submit)} noValidate autoComplete="off">
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
              {buildings.filter((b) => !b.archived || b.id === tenant?.buildingId).map((b) => {
                const st = optionState(b);
                return <option key={b.id} value={b.id} disabled={st.disabled}>{b.name}{st.note ? ` (${st.note})` : ""}</option>;
              })}
            </select>
          </FormField>
          <FormField label="House number (optional)" htmlFor="houseNo" error={e.houseNo?.message}>
            <Input id="houseNo" placeholder="e.g. B-204" autoComplete="off" {...form.register("houseNo")} aria-invalid={!!e.houseNo} />
          </FormField>
          <FormField label="Monthly rent (KES)" htmlFor="rentAmount" error={e.rentAmount?.message}>
            <Input id="rentAmount" type="number" min="1000" step="500" inputMode="numeric" placeholder="e.g. 25000" {...form.register("rentAmount")} aria-invalid={!!e.rentAmount} />
          </FormField>

          {/* The payment field depends on the building's paybill or till. */}
          {chosen?.shortcodeType === "paybill" && (
            <FormField label="Account number" htmlFor="accountRef" error={e.accountRef?.message}
              hint={`The number or name this tenant types as the “account” when paying to Paybill ${chosen.shortcodeNumber}. Payments are matched to them by it.`}>
              <Input id="accountRef" placeholder="e.g. KC-B-204" autoComplete="off" className="font-mono uppercase" {...form.register("accountRef")} aria-invalid={!!e.accountRef} />
            </FormField>
          )}
          {chosen?.shortcodeType === "till" && (
            <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground sm:self-end">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>Tenants here pay to Till {chosen.shortcodeNumber}, which has no account number. The app will suggest which payments belong to this tenant, and you check them under Payments.</span>
            </div>
          )}
          {chosen?.shortcodeType === "till" && (
            <FormField label="Also pays from (optional)" htmlFor="alsoPaysFrom" error={e.alsoPaysFrom?.message}
              hint="Someone else who pays this tenant’s rent, such as a spouse or relative. Add their name or phone number so their payments are recognised.">
              <Input id="alsoPaysFrom" placeholder="e.g. Peter Kamau, 0722 111 126" autoComplete="off" {...form.register("alsoPaysFrom")} aria-invalid={!!e.alsoPaysFrom} />
            </FormField>
          )}
          {chosen && !chosen.shortcodeType && tenant && (
            <FormField label="Account number (optional)" htmlFor="accountRef" error={e.accountRef?.message} hint="This building has no paybill or till attached yet.">
              <Input id="accountRef" autoComplete="off" className="font-mono uppercase" {...form.register("accountRef")} aria-invalid={!!e.accountRef} />
            </FormField>
          )}
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="outline" render={<Link href={back} />}>Cancel</Button>
          <Button type="submit" disabled={pending} className="bg-primary text-white hover:bg-primary/90">
            {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}{tenant ? "Save changes" : "Add tenant"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
