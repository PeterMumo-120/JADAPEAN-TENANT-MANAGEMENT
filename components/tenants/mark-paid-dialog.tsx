"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { money } from "@/lib/format";
import { markPaidSchema, type MarkPaidInput, type MarkPaidValues } from "@/lib/validators/payments";
import { markTenantPaid } from "@/lib/payments/actions";

/** Records rent received outside the automatic flow. The amount goes to the oldest unpaid month first. */
export function MarkPaidDialog({ open, onOpenChange, tenantId, tenantName, rent, today }: {
  open: boolean; onOpenChange: (o: boolean) => void; tenantId: string; tenantName: string; rent: number; today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<MarkPaidInput, unknown, MarkPaidValues>({
    resolver: zodResolver(markPaidSchema),
    defaultValues: { amount: "", paidOn: today, reference: "", note: "" },
  });
  const e = form.formState.errors;

  function submit(values: MarkPaidValues) {
    start(async () => {
      try {
        const r = await markTenantPaid(tenantId, values);
        if (!r.ok) {
          Object.entries(r.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as "amount", { message }));
          toast.error(r.message);
          return;
        }
        toast.success(r.message);
        form.reset({ amount: "", paidOn: today, reference: "", note: "" });
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {tenantName} as paid</DialogTitle>
          <DialogDescription>Use this for till payments, cash or anything that didn’t arrive automatically. It is applied to their oldest unpaid month first.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)} noValidate autoComplete="off">
          <FormField label="Amount received (KES)" htmlFor="mp-amount" error={e.amount?.message}>
            <Input id="mp-amount" type="number" min="1" inputMode="numeric" placeholder="e.g. 25000" {...form.register("amount")} aria-invalid={!!e.amount} />
            <button type="button" className="mt-1 self-start text-xs font-medium text-primary hover:underline" onClick={() => form.setValue("amount", rent, { shouldValidate: true })}>Use full rent ({money(rent)})</button>
          </FormField>
          <FormField label="Date received" htmlFor="mp-date" error={e.paidOn?.message}>
            <Input id="mp-date" type="date" max={today} {...form.register("paidOn")} aria-invalid={!!e.paidOn} />
          </FormField>
          <FormField label="M-Pesa code (optional)" htmlFor="mp-ref" error={e.reference?.message} hint="From the confirmation SMS. Leave empty for cash.">
            <Input id="mp-ref" placeholder="e.g. TLN7K2M9QA" className="font-mono uppercase" {...form.register("reference")} aria-invalid={!!e.reference} />
          </FormField>
          <FormField label="Note (optional)" htmlFor="mp-note" error={e.note?.message}>
            <Input id="mp-note" placeholder="e.g. Paid in cash at the office" {...form.register("note")} aria-invalid={!!e.note} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending} className="bg-primary text-white hover:bg-primary/90">{pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}Record payment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
