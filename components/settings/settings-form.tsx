"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveSettingsAction, type SettingsState } from "@/app/(protected)/settings/actions";
import type { SettingsMap } from "@/lib/settings";

function Row({ label, hint, error, children }: { label: string; hint: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-border px-5 py-4 last:border-0 sm:grid-cols-[1fr_180px] sm:items-center">
      <div><Label className="text-[13px]">{label}</Label><p className="mt-0.5 text-xs text-muted-foreground">{hint}</p></div>
      <div>{children}{error && <p className="mt-1 text-xs text-destructive" role="alert">{error}</p>}</div>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: SettingsMap }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  const [due, setDue] = useState(initial.rent_due_day);
  const [grace, setGrace] = useState(initial.grace_days);
  const [cooldown, setCooldown] = useState(initial.sync_cooldown_seconds);
  const [open, setOpen] = useState(initial.registration_open === "true");

  useEffect(() => {
    if (state.ok) toast.success("Settings saved");
    if (state.error) toast.error(state.error);
    if (state.fieldErrors) toast.error("Please fix the highlighted fields");
  }, [state]);

  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <Card className="panel-card">
        <div className="border-b px-5 py-4"><h2 className="font-display text-[18px]">Rent rules</h2><p className="mt-1 text-xs text-muted-foreground">Used to decide who is paid up, due or overdue.</p></div>
        <Row label="Rent is due on day" hint="Day of the month, 1 to 28." error={fe.rent_due_day}>
          <Input name="rent_due_day" type="number" min={1} max={28} value={due} onChange={(e) => setDue(e.target.value)} aria-invalid={!!fe.rent_due_day} />
        </Row>
        <Row label="Grace period (days)" hint="Days after the due day before a tenant counts as overdue." error={fe.grace_days}>
          <Input name="grace_days" type="number" min={0} max={15} value={grace} onChange={(e) => setGrace(e.target.value)} aria-invalid={!!fe.grace_days} />
        </Row>
        <Row label="Minimum seconds between refreshes" hint="Stops repeated payment refreshes from hammering M-Pesa." error={fe.sync_cooldown_seconds}>
          <Input name="sync_cooldown_seconds" type="number" min={10} max={3600} value={cooldown} onChange={(e) => setCooldown(e.target.value)} aria-invalid={!!fe.sync_cooldown_seconds} />
        </Row>
      </Card>

      <Card className="panel-card">
        <div className="border-b px-5 py-4"><h2 className="font-display text-[18px]">Admin access</h2></div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div><Label className="text-[13px]">Allow new access requests</Label><p className="mt-0.5 text-xs text-muted-foreground">Turn this off once your team has registered. Existing admins are not affected.</p></div>
          <Switch checked={open} onCheckedChange={setOpen} aria-label="Allow new access requests" />
          <input type="hidden" name="registration_open" value={String(open)} />
        </div>
      </Card>

      <Card className="panel-card">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div><Label className="text-[13px]">SMS reminders</Label><p className="mt-0.5 text-xs text-muted-foreground">Will be available once SMS is connected.</p></div>
          <Switch disabled checked={false} aria-label="SMS reminders (coming later)" />
        </div>
      </Card>

      <div><Button type="submit" disabled={pending} className="bg-primary text-white hover:bg-primary/90">{pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving…</> : "Save settings"}</Button></div>
    </form>
  );
}
