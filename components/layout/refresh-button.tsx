"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshPayments } from "@/lib/payments/actions";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => {
      try {
        const r = await refreshPayments("manual");
        if (r.ok) toast.success(r.message); else toast.error(r.message);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    })}>
      <RefreshCw className={`mr-1.5 size-4 ${pending ? "animate-spin" : ""}`} />{pending ? "Checking…" : "Refresh"}
    </Button>
  );
}
