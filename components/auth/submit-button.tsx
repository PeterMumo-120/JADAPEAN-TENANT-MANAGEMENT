"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmitButton({ children, pendingLabel, disabled }: { children: React.ReactNode; pendingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className="h-10 w-full bg-primary text-white hover:bg-primary/90">
      {pending ? (<><Loader2 className="mr-2 size-4 animate-spin" />{pendingLabel}</>) : children}
    </Button>
  );
}
