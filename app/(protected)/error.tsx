"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { toast.error("Something went wrong loading this page."); console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <h2 className="font-display text-2xl">Something went wrong</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">The page could not be loaded. Try again, and if it keeps happening, check the database and environment settings.</p>
      <Button className="mt-5" onClick={reset}>Try again</Button>
    </div>
  );
}
