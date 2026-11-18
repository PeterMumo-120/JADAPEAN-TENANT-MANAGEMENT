"use client";

import type { RefObject } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

/** Cloudflare Turnstile widget. The parent form keeps the token and the ref (to reset after a failed submit). */
export function TurnstileBox({
  widgetRef,
  onToken,
}: {
  widgetRef: RefObject<TurnstileInstance | null>;
  onToken: (token: string) => void;
}) {
  return (
    <Turnstile
      ref={widgetRef}
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
      onSuccess={onToken}
      onExpire={() => onToken("")}
      onError={() => onToken("")}
      options={{ theme: "auto", size: "flexible" }}
    />
  );
}
