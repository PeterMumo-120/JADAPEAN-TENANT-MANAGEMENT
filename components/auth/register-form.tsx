"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerAction, type AuthState } from "@/lib/auth/actions";
import { Field } from "@/components/auth/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { TurnstileBox } from "@/components/auth/turnstile-box";

export function RegisterForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState<AuthState, FormData>(registerAction, {});
  const [token, setToken] = useState("");
  const widget = useRef<TurnstileInstance>(null);
  const v = state.values ?? {};

  useEffect(() => {
    if (state.success) toast.success("Request sent", { description: "You will be able to sign in once an admin approves you." });
    if (state.error) toast.error(state.error);
    if (state.error || state.fieldErrors) { widget.current?.reset(); setToken(""); }
  }, [state]);

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CircleCheck className="size-10 text-primary" />
        <h3 className="font-display text-xl">Request received</h3>
        <p className="max-w-xs text-sm text-muted-foreground">{state.success}</p>
        <Button variant="outline" onClick={onDone}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="reg-first" error={state.fieldErrors?.firstName}>
          <Input id="reg-first" name="firstName" autoComplete="given-name" key={`f${v.firstName ?? ""}`} defaultValue={v.firstName} aria-invalid={!!state.fieldErrors?.firstName} />
        </Field>
        <Field label="Last name" htmlFor="reg-last" error={state.fieldErrors?.lastName}>
          <Input id="reg-last" name="lastName" autoComplete="family-name" key={`l${v.lastName ?? ""}`} defaultValue={v.lastName} aria-invalid={!!state.fieldErrors?.lastName} />
        </Field>
      </div>
      <Field label="Phone number" htmlFor="reg-phone" error={state.fieldErrors?.phone}>
        <Input id="reg-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" key={`p${v.phone ?? ""}`} defaultValue={v.phone} aria-invalid={!!state.fieldErrors?.phone} />
      </Field>
      <Field label="Passcode" htmlFor="reg-passcode" error={state.fieldErrors?.passcode} hint="At least 8 characters. You will use it to sign in.">
        <Input id="reg-passcode" name="passcode" type="password" autoComplete="new-password" aria-invalid={!!state.fieldErrors?.passcode} />
      </Field>
      <Field label="Confirm passcode" htmlFor="reg-confirm" error={state.fieldErrors?.confirmPasscode}>
        <Input id="reg-confirm" name="confirmPasscode" type="password" autoComplete="new-password" aria-invalid={!!state.fieldErrors?.confirmPasscode} />
      </Field>
      <input type="hidden" name="cf-turnstile-response" value={token} readOnly />
      <TurnstileBox widgetRef={widget} onToken={setToken} />
      <SubmitButton pendingLabel="Sending request…" disabled={!token}>Request access</SubmitButton>
      <p className="text-center text-xs text-muted-foreground">New accounts cannot sign in until an existing admin approves them.</p>
    </form>
  );
}
