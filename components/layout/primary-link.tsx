import Link from "next/link";
import { Plus } from "lucide-react";

/** Primary action in a page header (a real link, so it works without JavaScript). */
export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary/90">
      <Plus className="size-4" />{children}
    </Link>
  );
}
