"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshPayments } from "@/lib/payments/actions";

/** Renders nothing. On dashboard open it asks the server to pull new M-Pesa payments (the cooldown setting stops repeat pulls). */
export function AutoSync() {
  const router = useRouter();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    refreshPayments("page_open")
      .then((r) => { if (r.inserted > 0) { toast.success(r.message); router.refresh(); } })
      .catch(() => {});
  }, [router]);
  return null;
}
