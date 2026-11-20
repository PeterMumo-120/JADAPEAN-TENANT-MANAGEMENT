"use client";

import { useTransition } from "react";
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
import { shortcodeSchema, type ShortcodeInput, type ShortcodeValues } from "@/lib/validators/shortcodes";
import { createShortcode, updateShortcode } from "@/lib/shortcodes/actions";

export type ShortcodeFormData = {
  id: string; label: string; type: "paybill" | "till"; number: string; env: "sandbox" | "production";
  consumerKey: string | null; hasSecret: boolean; nominatedNumber: string | null; locked: boolean;
};

const selectClass = "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive disabled:opacity-50";

export function ShortcodeForm({ shortcode }: { shortcode?: ShortcodeFormData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<ShortcodeInput, unknown, ShortcodeValues>({
    resolver: zodResolver(shortcodeSchema),
    defaultValues: {
      label: shortcode?.label ?? "", type: shortcode?.type ?? ("" as "paybill"), number: shortcode?.number ?? "", env: shortcode?.env ?? ("" as "sandbox"),
      consumerKey: shortcode?.consumerKey ?? "", consumerSecret: "", nominatedNumber: shortcode?.nominatedNumber ?? "",
    },
  });
  const e = form.formState.errors;
  const type = form.watch("type");

  function submit(values: ShortcodeValues) {
    start(async () => {
      try {
        const r = shortcode ? await updateShortcode(shortcode.id, values) : await createShortcode(values);
        if (!r.ok) {
          Object.entries(r.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as "label", { message }));
          toast.error(r.message);
          return;
        }
        toast.success(r.message);
        router.push("/shortcodes");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Card className="panel-card">
      <form className="flex flex-col gap-5 p-5 sm:p-6" onSubmit={form.handleSubmit(submit)} noValidate autoComplete="off">
        {shortcode?.locked && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Buildings or payments already use this shortcode, so its type and number are locked. Everything else can still be edited.</p>
        )}
        <FormField label="Name" htmlFor="label" error={e.label?.message} hint="Only you see this. It helps tell your paybills and tills apart.">
          <Input id="label" placeholder="e.g. Kijani Court paybill" {...form.register("label")} aria-invalid={!!e.label} />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Type" htmlFor="type" error={e.type?.message}>
            <select id="type" className={selectClass} disabled={shortcode?.locked} aria-invalid={!!e.type} {...form.register("type")}>
              <option value="">Select a type</option>
              <option value="paybill">Paybill (tenants type an account number)</option>
              <option value="till">Till / Buy Goods (no account number)</option>
            </select>
          </FormField>
          <FormField label={type === "till" ? "Till number" : type === "paybill" ? "Paybill number" : "Paybill or till number"} htmlFor="number" error={e.number?.message}>
            <Input id="number" inputMode="numeric" placeholder="e.g. 400200" disabled={shortcode?.locked} className="font-mono" {...form.register("number")} aria-invalid={!!e.number} />
          </FormField>
        </div>

        <FormField label="Environment" htmlFor="env" error={e.env?.message} hint="Sandbox is for testing with Safaricom’s fake money. Production is live.">
          <select id="env" className={selectClass} aria-invalid={!!e.env} {...form.register("env")}>
            <option value="">Select an environment</option>
            <option value="sandbox">Sandbox (testing)</option>
            <option value="production">Production (live)</option>
          </select>
        </FormField>

        <div className="rounded-xl border border-border p-4">
          <h3 className="text-[13px] font-medium">Daraja app credentials</h3>
          <p className="mt-1 text-xs text-muted-foreground">Each paybill or till has its own app on developer.safaricom.co.ke. Paste that app’s keys here. You can save without them and add them later, but automatic sync stays off until you do.</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <FormField label="Consumer key" htmlFor="consumerKey" error={e.consumerKey?.message}>
              <Input id="consumerKey" autoComplete="off" className="font-mono" {...form.register("consumerKey")} aria-invalid={!!e.consumerKey} />
            </FormField>
            <FormField label="Consumer secret" htmlFor="consumerSecret" error={e.consumerSecret?.message}
              hint={shortcode?.hasSecret ? "A secret is saved. Leave this empty to keep it, or type a new one to replace it." : "Stored encrypted. It is never shown again."}>
              <Input id="consumerSecret" type="password" autoComplete="new-password" className="font-mono" placeholder={shortcode?.hasSecret ? "••••••••••••" : undefined} {...form.register("consumerSecret")} aria-invalid={!!e.consumerSecret} />
            </FormField>
          </div>
          <div className="mt-5">
            <FormField label="Nominated number (optional)" htmlFor="nominatedNumber" error={e.nominatedNumber?.message}
              hint="The Safaricom number linked to this shortcode in the M-Pesa portal. Needed to register Pull Transactions.">
              <Input id="nominatedNumber" inputMode="tel" placeholder="0722 000 000" {...form.register("nominatedNumber")} aria-invalid={!!e.nominatedNumber} />
            </FormField>
          </div>
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="outline" render={<Link href="/shortcodes" />}>Cancel</Button>
          <Button type="submit" disabled={pending} className="bg-primary text-white hover:bg-primary/90">
            {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}{shortcode ? "Save changes" : "Add paybill or till"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
