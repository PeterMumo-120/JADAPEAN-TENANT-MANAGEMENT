"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { Input } from "@/components/ui/input";
import { loginAction, type AuthState } from "@/lib/auth/actions";
import { Field } from "@/components/auth/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { TurnstileBox } from "@/components/auth/turnstile-box";

export function LoginForm() {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});
  const [token, setToken] = useState("");
  const widget = useRef<TurnstileInstance>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.error || state.fieldErrors) { widget.current?.reset(); setToken(""); } // tokens are single-use
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Phone number" htmlFor="login-phone" error={state.fieldErrors?.phone}>
        <Input id="login-phone" name="phone" type="tel" inputMode="tel" autoComplete="username" placeholder="0712 345 678"
          key={state.values?.phone ?? "phone"} defaultValue={state.values?.phone} aria-invalid={!!state.fieldErrors?.phone} />
      </Field>
      <Field label="Passcode" htmlFor="login-passcode" error={state.fieldErrors?.passcode}>
        <Input id="login-passcode" name="passcode" type="password" autoComplete="current-password" aria-invalid={!!state.fieldErrors?.passcode} />
      </Field>
      <input type="hidden" name="cf-turnstile-response" value={token} readOnly />
      <TurnstileBox widgetRef={widget} onToken={setToken} />
      <SubmitButton pendingLabel="Signing in…" disabled={!token}>Sign in</SubmitButton>
    </form>
  );
}
