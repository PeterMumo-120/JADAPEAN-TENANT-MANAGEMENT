"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Re-fetches the page. Once the M-Pesa sync exists, call its server action here before router.refresh(). */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" className="hidden h-9 gap-2 sm:flex" disabled={pending}
      onClick={() => start(() => { router.refresh(); toast.success("Refreshed"); })}>
      <Activity className={`size-3.5 ${pending ? "animate-pulse" : ""}`} /> Refresh
    </Button>
  );
}
